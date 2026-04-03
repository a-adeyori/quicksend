import { Router, Request, Response, NextFunction } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { PaymentStatus } from '@prisma/client';
import { db } from '../config/database';
import { config } from '../config/env';
import { AppError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { rafikiService, dollarsToUnits, unitsToDollars, formatCurrency } from '../services/rafikiService';
import { logger } from '../utils/logger';

const router = Router();
router.use(authenticate);

// Stricter rate limit for send money (10 per 15 min per user)
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
  recipientWalletAddress: z.string().url(),
  recipientName: z.string().min(1).max(100),
  amountDollars: z.number().positive().min(1).max(10_000),
  note: z.string().max(200).optional(),
  quoteId: z.string().uuid().optional(), // optional: reuse a recent quote
});

// ─── GET /payments — Transaction history ─────────────────────────────────────

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).user.id;
    const { type, status, cursor, limit = '20' } = req.query as Record<string, string>;

    const take = Math.min(parseInt(limit) || 20, 100);

    const where: Record<string, unknown> = {
      OR: [{ senderId: userId }, { receiverId: userId }],
    };

    if (status) where.status = status.toUpperCase() as PaymentStatus;

    // type filter
    if (type === 'sent') where.senderId = userId;
    if (type === 'received') where.receiverId = userId;

    const payments = await db.payment.findMany({
      where,
      take: take + 1, // fetch one extra to determine hasNextPage
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        senderId: true,
        receiverId: true,
        recipientName: true,
        recipientWalletAddress: true,
        debitAmountCents: true,
        receiveAmountCents: true,
        feeAmountCents: true,
        assetCode: true,
        assetScale: true,
        status: true,
        note: true,
        reference: true,
        ilpOutgoingPaymentId: true,
        initiatedAt: true,
        completedAt: true,
      },
    });

    const hasNextPage = payments.length > take;
    const results = hasNextPage ? payments.slice(0, take) : payments;
    const nextCursor = hasNextPage ? results[results.length - 1].id : null;

    // Format amounts
    const formatted = results.map((p) => ({
      ...p,
      debitAmountCents: Number(p.debitAmountCents),
      receiveAmountCents: Number(p.receiveAmountCents),
      feeAmountCents: Number(p.feeAmountCents),
      type: p.senderId === userId ? 'outgoing' : 'incoming',
      amountFormatted: formatCurrency(
        p.debitAmountCents.toString(),
        p.assetScale,
        p.assetCode
      ),
    }));

    res.json({
      data: formatted,
      pagination: { hasNextPage, nextCursor },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /payments/:id — Single payment ──────────────────────────────────────

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).user.id;
    const payment = await db.payment.findFirst({
      where: {
        id: req.params.id,
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
    });
    if (!payment) throw AppError.notFound('Payment');
    res.json({
      ...payment,
      debitAmountCents: Number(payment.debitAmountCents),
      receiveAmountCents: Number(payment.receiveAmountCents),
      feeAmountCents: Number(payment.feeAmountCents),
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /payments/quote — Get ILP quote ────────────────────────────────────

router.post('/quote', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).user.id;
    const { recipientWalletAddress, amountDollars } = quoteSchema.parse(req.body);

    // Get sender's wallet address
    const sender = await db.user.findUnique({
      where: { id: userId },
      select: { walletAddress: true, assetCode: true, assetScale: true, balanceCents: true },
    });

    if (!sender?.walletAddress) {
      // No ILP wallet connected: return a mock/estimated quote
      const estimatedFeeCents = Math.max(2, Math.round(amountDollars * 0.001 * 100)); // 0.1% min $0.02
      const debitCents = Math.round(amountDollars * 100) + estimatedFeeCents;
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

    // Balance check
    const debitCents = BigInt(dollarsToUnits(amountDollars, sender.assetScale));
    if (sender.balanceCents < debitCents) {
      throw AppError.badRequest('Insufficient balance', 'INSUFFICIENT_FUNDS');
    }

    // Resolve recipient
    const recipientInfo = await rafikiService.resolveWalletAddress(recipientWalletAddress);

    // Get incoming payment grant + create incoming payment at recipient
    const incomingToken = await rafikiService.requestIncomingPaymentGrant(recipientWalletAddress);
    const incomingPayment = await rafikiService.createIncomingPayment(
      recipientWalletAddress,
      incomingToken,
      {
        incomingAmountUnits: dollarsToUnits(amountDollars, recipientInfo.assetScale),
        assetCode: recipientInfo.assetCode,
        assetScale: recipientInfo.assetScale,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      }
    );

    // Get outgoing payment grant
    const outgoingToken = await rafikiService.requestOutgoingPaymentGrant(
      sender.walletAddress,
      debitCents.toString(),
      sender.assetCode,
      sender.assetScale
    );

    // Create quote
    const quote = await rafikiService.createQuote(
      sender.walletAddress,
      incomingPayment.id,
      debitCents.toString(),
      sender.assetCode,
      sender.assetScale,
      outgoingToken
    );

    const feeCents =
      parseInt(quote.debitAmount.value) - parseInt(quote.receiveAmount.value);

    res.json({
      mode: 'live',
      quoteId: quote.id,
      incomingPaymentId: incomingPayment.id,
      amountDollars,
      debitAmount: quote.debitAmount,
      receiveAmount: quote.receiveAmount,
      estimatedFee: formatCurrency(Math.max(0, feeCents).toString(), quote.debitAmount.assetScale, quote.debitAmount.assetCode),
      totalDebit: formatCurrency(quote.debitAmount.value, quote.debitAmount.assetScale, quote.debitAmount.assetCode),
      expiresAt: quote.expiresAt,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /payments/send — Execute payment ────────────────────────────────────

router.post('/send', sendLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).user.id;
    const body = sendSchema.parse(req.body);

    const sender = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true, walletAddress: true, assetCode: true, assetScale: true,
        balanceCents: true, kycStatus: true,
      },
    });

    if (!sender) throw AppError.notFound('User');
    if (sender.kycStatus !== 'APPROVED') {
      throw AppError.forbidden('Account verification required to send money');
    }

    const debitCents = BigInt(dollarsToUnits(body.amountDollars, sender.assetScale ?? 2));

    if (sender.balanceCents < debitCents) {
      throw AppError.badRequest('Insufficient balance', 'INSUFFICIENT_FUNDS');
    }

    // Create payment record (PENDING)
    const payment = await db.payment.create({
      data: {
        senderId: userId,
        recipientWalletAddress: body.recipientWalletAddress,
        recipientName: body.recipientName,
        debitAmountCents: debitCents,
        receiveAmountCents: debitCents, // updated after quote
        assetCode: sender.assetCode,
        assetScale: sender.assetScale ?? 2,
        note: body.note,
        status: 'PENDING',
      },
    });

    logger.info('Payment initiated', { paymentId: payment.id, userId, amount: body.amountDollars });

    // ── ILP flow (if wallet connected) ────────────────────────────────────

    if (sender.walletAddress) {
      // Update status to PROCESSING
      await db.payment.update({ where: { id: payment.id }, data: { status: 'PROCESSING' } });

      try {
        const { payment: ilpPayment, quote } = await rafikiService.executeSendMoney({
          senderWalletAddress: sender.walletAddress,
          recipientWalletAddress: body.recipientWalletAddress,
          amountDollars: body.amountDollars,
          metadata: {
            quicksendPaymentId: payment.id,
            recipientName: body.recipientName,
            note: body.note ?? '',
          },
        });

        const feeCents = BigInt(parseInt(quote.debitAmount.value)) - BigInt(parseInt(quote.receiveAmount.value));

        // Update DB: mark COMPLETED, deduct balance
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
          db.user.update({
            where: { id: userId },
            data: { balanceCents: { decrement: debitCents } },
          }),
        ]);

        // Notify
        await db.notification.create({
          data: {
            userId,
            type: 'PAYMENT_SENT',
            title: 'Payment Sent ✓',
            body: `$${body.amountDollars.toFixed(2)} sent to ${body.recipientName}`,
            data: { paymentId: payment.id },
          },
        });

        await db.auditLog.create({
          data: {
            userId,
            action: 'PAYMENT_COMPLETED',
            resource: 'payment',
            resourceId: payment.id,
            metadata: { ilpPaymentId: ilpPayment.id, amountDollars: body.amountDollars },
            ipAddress: req.ip,
          },
        });

        logger.info('Payment completed', { paymentId: payment.id, ilpId: ilpPayment.id });

        return res.status(201).json({
          payment: {
            ...payment,
            id: payment.id,
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

    // ── Demo / no-wallet mode ─────────────────────────────────────────────

    await db.$transaction([
      db.payment.update({
        where: { id: payment.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      }),
      db.user.update({
        where: { id: userId },
        data: { balanceCents: { decrement: debitCents } },
      }),
    ]);

    res.status(201).json({
      payment: { ...payment, status: 'COMPLETED', debitAmountCents: Number(debitCents) },
      message: 'Payment completed (demo mode — no ILP wallet connected)',
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /payments/:id/cancel ────────────────────────────────────────────────

router.post('/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).user.id;
    const payment = await db.payment.findFirst({
      where: { id: req.params.id, senderId: userId },
    });
    if (!payment) throw AppError.notFound('Payment');
    if (!['PENDING', 'QUOTED'].includes(payment.status)) {
      throw AppError.badRequest(`Cannot cancel a payment in ${payment.status} state`);
    }
    await db.payment.update({ where: { id: payment.id }, data: { status: 'CANCELLED' } });
    res.json({ message: 'Payment cancelled' });
  } catch (err) {
    next(err);
  }
});

export default router;
