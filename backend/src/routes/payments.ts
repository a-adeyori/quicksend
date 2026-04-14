import { Router, Request, Response, NextFunction } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import type { PaymentStatus } from '../jsonDb/types';
import { db } from '../config/database';
import { config } from '../config/env';
import { AppError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { rafikiService, dollarsToUnits, formatCurrency } from '../services/rafikiService';
import { logger } from '../utils/logger';
import { requireRouteParam } from '../utils/routeParams';

const router = Router();
router.use(authenticate);

const sendLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitSendMax,
  keyGenerator: (req) => (req as AuthRequest).user.id,
  message: { error: 'Too many payment attempts. Please wait before trying again.' },
});

// ─── Schemas ──────────────────────────────────────────────────────────────────

const quoteSchema = z.object({
  recipientWalletAddress: z.string().url('Must be a valid wallet address URL'),
  amountDollars: z.number().positive().min(1).max(10_000),
});

const sendSchema = z.object({
  recipientUsername: z.string().min(1).max(30).optional(),  // ← NEW: @username
  recipientWalletAddress: z.string().url().optional(),
  recipientUserId: z.string().uuid().optional(),
  recipientEmail: z.string().email().optional(),
  recipientName: z.string().min(1).max(100).optional(),
  amountDollars: z.number().positive().min(1).max(10_000),
  note: z.string().max(200).optional(),
  quoteId: z.string().uuid().optional(),
});

// ─── GET /payments ────────────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).user.id;
    const { type, status, cursor, limit = '20' } = req.query as Record<string, string>;
    const take = Math.min(parseInt(limit) || 20, 100);

    const where: Record<string, unknown> = {
      OR: [{ senderId: userId }, { receiverId: userId }],
    };
    if (status) where.status = status.toUpperCase() as PaymentStatus;
    if (type === 'sent') where.senderId = userId;
    if (type === 'received') where.receiverId = userId;

    const payments = await db.payment.findMany({
      where,
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, senderId: true, receiverId: true,
        recipientName: true, recipientWalletAddress: true,
        debitAmountCents: true, receiveAmountCents: true, feeAmountCents: true,
        assetCode: true, assetScale: true, status: true,
        note: true, reference: true, ilpOutgoingPaymentId: true,
        initiatedAt: true, completedAt: true,
      },
    });

    const hasNextPage = payments.length > take;
    const results = hasNextPage ? payments.slice(0, take) : payments;
    const nextCursor = hasNextPage ? results[results.length - 1].id : null;

    res.json({
      data: results.map((p) => ({
        ...p,
        debitAmountCents: Number(p.debitAmountCents),
        receiveAmountCents: Number(p.receiveAmountCents),
        feeAmountCents: Number(p.feeAmountCents),
        type: p.senderId === userId ? 'outgoing' : 'incoming',
        amountFormatted: formatCurrency(p.debitAmountCents.toString(), p.assetScale, p.assetCode),
      })),
      pagination: { hasNextPage, nextCursor },
    });
  } catch (err) { next(err); }
});

// ─── GET /payments/:id ────────────────────────────────────────────────────────

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).user.id;
    const paymentId = requireRouteParam(req.params.id);
    const payment = await db.payment.findFirst({
      where: { id: paymentId, OR: [{ senderId: userId }, { receiverId: userId }] },
    });
    if (!payment) throw AppError.notFound('Payment');
    res.json({
      ...payment,
      debitAmountCents: Number(payment.debitAmountCents),
      receiveAmountCents: Number(payment.receiveAmountCents),
      feeAmountCents: Number(payment.feeAmountCents),
    });
  } catch (err) { next(err); }
});

// ─── POST /payments/quote ─────────────────────────────────────────────────────

router.post('/quote', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).user.id;
    const { recipientWalletAddress, amountDollars } = quoteSchema.parse(req.body);

    const sender = await db.user.findUnique({
      where: { id: userId },
      select: { walletAddress: true, assetCode: true, assetScale: true, balanceCents: true },
    });

    const estimatedFeeCents = Math.max(2, Math.round(amountDollars * 0.001 * 100));
    const debitCents = Math.round(amountDollars * 100) + estimatedFeeCents;

    if (!sender?.walletAddress) {
      return res.json({
        mode: 'estimated',
        amountDollars,
        debitAmount: { value: debitCents.toString(), assetCode: 'USD', assetScale: 2 },
        receiveAmount: { value: (debitCents - estimatedFeeCents).toString(), assetCode: 'USD', assetScale: 2 },
        estimatedFee: formatCurrency(estimatedFeeCents.toString(), 2, 'USD'),
        totalDebit: formatCurrency(debitCents.toString(), 2, 'USD'),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });
    }

    const debitBigInt = BigInt(dollarsToUnits(amountDollars, sender.assetScale));
    if (sender.balanceCents < debitBigInt) {
      throw AppError.badRequest('Insufficient balance', 'INSUFFICIENT_FUNDS');
    }

    res.json({
      mode: 'estimated',
      amountDollars,
      estimatedFee: formatCurrency(estimatedFeeCents.toString(), 2, 'USD'),
      totalDebit: formatCurrency(debitCents.toString(), 2, 'USD'),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    });
  } catch (err) { next(err); }
});

// ─── POST /payments/send ──────────────────────────────────────────────────────

router.post('/send', sendLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).user.id;
    const body = sendSchema.parse(req.body);

    const sender = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, walletAddress: true, assetCode: true, assetScale: true, balanceCents: true },
    });
    if (!sender) throw AppError.notFound('User');

    const debitCents = BigInt(dollarsToUnits(body.amountDollars, sender.assetScale ?? 2));
    if (sender.balanceCents < debitCents) {
      throw AppError.badRequest('Insufficient balance', 'INSUFFICIENT_FUNDS');
    }

    // ── Resolve recipient ─────────────────────────────────────────────────────
    let recipientUser: {
      id: string; firstName: string; lastName: string;
      username: string; email: string; walletAddress: string | null;
    } | null = null;

    if (body.recipientUsername) {
      // Strip leading @ if present
      const uname = body.recipientUsername.replace(/^@/, '').toLowerCase();
      recipientUser = await db.user.findUnique({
        where: { username: uname },
        select: { id: true, firstName: true, lastName: true, username: true, email: true, walletAddress: true },
      });
      if (!recipientUser) throw AppError.notFound(`No user found with username @${uname}`);
    } else if (body.recipientUserId) {
      recipientUser = await db.user.findUnique({
        where: { id: body.recipientUserId },
        select: { id: true, firstName: true, lastName: true, username: true, email: true, walletAddress: true },
      });
    } else if (body.recipientEmail) {
      recipientUser = await db.user.findUnique({
        where: { email: body.recipientEmail.toLowerCase() },
        select: { id: true, firstName: true, lastName: true, username: true, email: true, walletAddress: true },
      });
    } else if (body.recipientWalletAddress) {
      recipientUser = await db.user.findUnique({
        where: { walletAddress: body.recipientWalletAddress },
        select: { id: true, firstName: true, lastName: true, username: true, email: true, walletAddress: true },
      });
    }

    if (recipientUser?.id === userId) {
      throw AppError.badRequest('You cannot send money to yourself', 'SELF_TRANSFER_NOT_ALLOWED');
    }

    const recipientWalletAddress = recipientUser?.walletAddress ?? body.recipientWalletAddress;
    if (!recipientWalletAddress) {
      throw AppError.badRequest(
        'Recipient not found. Search by @username, email, or wallet address.',
        'RECIPIENT_REQUIRED'
      );
    }

    const recipientName = body.recipientName
      || (recipientUser ? `${recipientUser.firstName} ${recipientUser.lastName}`.trim() : undefined)
      || recipientUser?.email
      || 'Recipient';

    // Create payment record
    const payment = await db.payment.create({
      data: {
        senderId: userId,
        receiverId: recipientUser?.id,
        recipientWalletAddress,
        recipientName,
        debitAmountCents: debitCents,
        receiveAmountCents: debitCents,
        assetCode: sender.assetCode,
        assetScale: sender.assetScale ?? 2,
        note: body.note,
        status: 'PENDING',
      },
    });

    logger.info('Payment initiated', { paymentId: payment.id, userId, amount: body.amountDollars });

    // ── Internal transfer (both users on QuickSend) ───────────────────────────
    // Credit receiver, debit sender directly in DB
    if (recipientUser?.id) {
      await db.$transaction([
        db.payment.update({
          where: { id: payment.id },
          data: { status: 'COMPLETED', completedAt: new Date() },
        }),
        db.user.update({
          where: { id: userId },
          data: { balanceCents: { decrement: debitCents } },
        }),
        db.user.update({
          where: { id: recipientUser.id },
          data: { balanceCents: { increment: debitCents } },
        }),
      ]);

      // Notifications
      await db.notification.createMany({
        data: [
          {
            userId,
            type: 'PAYMENT_SENT',
            title: 'Payment Sent ✓',
            body: `$${body.amountDollars.toFixed(2)} sent to @${recipientUser.username}`,
            data: { paymentId: payment.id },
          },
          {
            userId: recipientUser.id,
            type: 'PAYMENT_RECEIVED',
            title: 'Money Received 💰',
            body: `You received $${body.amountDollars.toFixed(2)}${body.note ? ` · ${body.note}` : ''}`,
            data: { paymentId: payment.id, senderId: userId },
          },
        ],
      });

      return res.status(201).json({
        payment: {
          ...payment,
          status: 'COMPLETED',
          debitAmountCents: Number(debitCents),
          receiveAmountCents: Number(debitCents),
          feeAmountCents: 0,
        },
        message: 'Payment sent successfully',
      });
    }

    // ── External ILP transfer ─────────────────────────────────────────────────
    if (sender.walletAddress) {
      await db.payment.update({ where: { id: payment.id }, data: { status: 'PROCESSING' } });
      try {
        const { payment: ilpPayment, quote } = await rafikiService.executeSendMoney({
          senderWalletAddress: sender.walletAddress,
          recipientWalletAddress,
          amountDollars: body.amountDollars,
          metadata: { quicksendPaymentId: payment.id, recipientName, note: body.note ?? '' },
        });
        const feeCents = BigInt(parseInt(quote.debitAmount.value)) - BigInt(parseInt(quote.receiveAmount.value));
        await db.$transaction([
          db.payment.update({
            where: { id: payment.id },
            data: {
              status: 'COMPLETED',
              ilpQuoteId: quote.id,
              ilpOutgoingPaymentId: ilpPayment.id,
              receiveAmountCents: BigInt(parseInt(quote.receiveAmount.value)),
              feeAmountCents: feeCents > 0n ? feeCents : 0n,
              completedAt: new Date(),
            },
          }),
          db.user.update({ where: { id: userId }, data: { balanceCents: { decrement: debitCents } } }),
        ]);
        return res.status(201).json({
          payment: {
            ...payment,
            status: 'COMPLETED',
            ilpOutgoingPaymentId: ilpPayment.id,
            debitAmountCents: Number(debitCents),
            receiveAmountCents: parseInt(quote.receiveAmount.value),
            feeAmountCents: Number(feeCents > 0n ? feeCents : 0n),
          },
          message: 'Payment sent successfully via ILP',
        });
      } catch (ilpErr) {
        await db.payment.update({
          where: { id: payment.id },
          data: { status: 'FAILED', failReason: (ilpErr as Error).message, failedAt: new Date() },
        });
        throw ilpErr;
      }
    }

    // ── Fallback: no wallet ───────────────────────────────────────────────────
    await db.$transaction([
      db.payment.update({ where: { id: payment.id }, data: { status: 'COMPLETED', completedAt: new Date() } }),
      db.user.update({ where: { id: userId }, data: { balanceCents: { decrement: debitCents } } }),
    ]);

    res.status(201).json({
      payment: {
        ...payment,
        status: 'COMPLETED',
        debitAmountCents: Number(debitCents),
        receiveAmountCents: Number(payment.receiveAmountCents),
        feeAmountCents: Number(payment.feeAmountCents),
      },
      message: 'Payment sent successfully',
    });
  } catch (err) { next(err); }
});

// ─── POST /payments/:id/cancel ────────────────────────────────────────────────

router.post('/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).user.id;
    const paymentId = requireRouteParam(req.params.id);
    const payment = await db.payment.findFirst({ where: { id: paymentId, senderId: userId } });
    if (!payment) throw AppError.notFound('Payment');
    if (!['PENDING', 'QUOTED'].includes(payment.status)) {
      throw AppError.badRequest(`Cannot cancel a payment in ${payment.status} state`);
    }
    await db.payment.update({ where: { id: payment.id }, data: { status: 'CANCELLED' } });
    res.json({ message: 'Payment cancelled' });
  } catch (err) { next(err); }
});

export default router;