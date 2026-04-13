import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../config/database';
import { config } from '../config/env';
import { AppError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { rafikiService, formatCurrency, dollarsToUnits } from '../services/rafikiService';
import { rafikiAdminService } from '../services/rafikiAdminService';
import { logger } from '../utils/logger';

const router = Router();
router.use(authenticate);

const connectSchema = z.object({
  walletAddress: z.string().url('Must be a valid Open Payments wallet address URL'),
});

const depositSchema = z.object({
  amountDollars: z.number().positive().min(1),
});

const createWalletSchema = z.object({
  publicName: z.string().min(2).max(80).optional(),
});

// ─── POST /wallet/connect ─────────────────────────────────────────────────────
// Validate and link an external ILP wallet address to the user's account.

router.post('/connect', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).user.id;
    const { walletAddress } = connectSchema.parse(req.body);

    // Resolve wallet address via Open Payments discovery
    let walletInfo;
    try {
      walletInfo = await rafikiService.resolveWalletAddress(walletAddress);
    } catch {
      throw AppError.badRequest(
        'Could not resolve this wallet address. Make sure it is a valid Open Payments URL.',
        'WALLET_RESOLUTION_FAILED'
      );
    }

    // Check not already used by another user
    const existing = await db.user.findFirst({
      where: { walletAddress, NOT: { id: userId } },
    });
    if (existing) throw AppError.conflict('This wallet address is already linked to another account');

    await db.user.update({
      where: { id: userId },
      data: { walletAddress, assetCode: walletInfo.assetCode, assetScale: walletInfo.assetScale },
    });

    logger.info('Wallet connected', { userId, walletAddress, assetCode: walletInfo.assetCode });

    res.json({
      message: 'Wallet connected successfully',
      wallet: {
        address: walletAddress,
        publicName: walletInfo.publicName,
        assetCode: walletInfo.assetCode,
        assetScale: walletInfo.assetScale,
      },
    });
  } catch (err) { next(err); }
});

// ─── POST /wallet/create-address ──────────────────────────────────────────────
// Create a tenant-scoped Rafiki wallet address for the signed-in user.
router.post('/create-address', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).user.id;
    const { publicName } = createWalletSchema.parse(req.body ?? {});

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, walletAddress: true },
    });
    if (!user) throw AppError.notFound('User');
    if (user.walletAddress) {
      return res.status(409).json({
        error: 'User already has a wallet address',
        walletAddress: user.walletAddress,
      });
    }

    if (!config.rafikiWalletAssetId) {
      throw AppError.badRequest(
        'RAFIKI_WALLET_ASSET_ID is required to create wallet addresses',
        'RAFIKI_WALLET_ASSET_ID_MISSING'
      );
    }

    const created = await rafikiAdminService.createWalletAddress({
      publicName: publicName?.trim() || `${user.firstName} ${user.lastName}`.trim(),
      assetId: config.rafikiWalletAssetId,
    });

    await db.user.update({
      where: { id: userId },
      data: {
        walletAddress: created.url,
        ilpAccountId: created.id,
        assetCode: created.asset?.code ?? 'USD',
        assetScale: created.asset?.scale ?? 2,
      },
    });

    logger.info('Wallet address created for user', {
      userId,
      walletAddress: created.url,
      walletAddressId: created.id,
    });

    res.status(201).json({
      message: 'Wallet address created',
      wallet: {
        id: created.id,
        address: created.url,
        publicName: created.publicName,
        assetCode: created.asset?.code ?? 'USD',
        assetScale: created.asset?.scale ?? 2,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /wallet/disconnect ────────────────────────────────────────────────

router.delete('/disconnect', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).user.id;
    await db.user.update({ where: { id: userId }, data: { walletAddress: null } });
    res.json({ message: 'Wallet disconnected' });
  } catch (err) { next(err); }
});

// ─── GET /wallet/info ─────────────────────────────────────────────────────────

router.get('/info', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await db.user.findUnique({
      where: { id: (req as AuthRequest).user.id },
      select: { walletAddress: true, assetCode: true, assetScale: true, balanceCents: true },
    });
    if (!user) throw AppError.notFound('User');

    let walletInfo = null;
    if (user.walletAddress) {
      try {
        walletInfo = await rafikiService.resolveWalletAddress(user.walletAddress);
      } catch {
        // Wallet may be temporarily unreachable
      }
    }

    res.json({
      isConnected: !!user.walletAddress,
      walletAddress: user.walletAddress,
      walletInfo,
      balance: {
        value: user.balanceCents.toString(),
        assetCode: user.assetCode,
        assetScale: user.assetScale,
        formatted: formatCurrency(user.balanceCents.toString(), user.assetScale, user.assetCode),
      },
    });
  } catch (err) { next(err); }
});

// ─── POST /wallet/sync-balance ────────────────────────────────────────────────
// Fetch the latest completed payment totals from Rafiki and re-compute balance.

router.post('/sync-balance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).user.id;

    // Sum from DB (source of truth for the platform-level ledger)
    const [incomingAgg, outgoingAgg] = await Promise.all([
      db.payment.aggregate({
        where: { receiverId: userId, status: 'COMPLETED' },
        _sum: { receiveAmountCents: true },
      }),
      db.payment.aggregate({
        where: { senderId: userId, status: 'COMPLETED' },
        _sum: { debitAmountCents: true },
      }),
    ]);

    const incoming = incomingAgg._sum.receiveAmountCents ?? 0n;
    const outgoing = outgoingAgg._sum.debitAmountCents ?? 0n;
    const balance = incoming - outgoing;

    await db.user.update({
      where: { id: userId },
      data: { balanceCents: balance > 0n ? balance : 0n },
    });

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { balanceCents: true, assetCode: true, assetScale: true },
    });

    res.json({
      balance: {
        value: user!.balanceCents.toString(),
        assetCode: user!.assetCode,
        assetScale: user!.assetScale,
        formatted: formatCurrency(user!.balanceCents.toString(), user!.assetScale, user!.assetCode),
      },
    });
  } catch (err) { next(err); }
});

// ─── POST /wallet/deposit (dev/test only) ─────────────────────────────────────
// Simulate a deposit for testing without a real incoming ILP payment.

router.post('/deposit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).user.id;
    const { amountDollars } = depositSchema.parse(req.body);

    const user = await db.user.findUnique({ where: { id: userId }, select: { assetScale: true } });
    const cents = BigInt(dollarsToUnits(amountDollars, user?.assetScale ?? 2));

    await db.user.update({
      where: { id: userId },
      data: { balanceCents: { increment: cents } },
    });

    const updated = await db.user.findUnique({
      where: { id: userId },
      select: { balanceCents: true, assetCode: true, assetScale: true },
    });

    logger.info('[DEV] Balance topped up', { userId, amountDollars });

    res.json({
      message: `Deposited $${amountDollars.toFixed(2)} (dev mode)`,
      newBalance: formatCurrency(updated!.balanceCents.toString(), updated!.assetScale, updated!.assetCode),
    });
  } catch (err) { next(err); }
});

export default router;
