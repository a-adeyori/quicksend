/**
 * Rafiki Webhook Handler
 *
 * Rafiki sends signed webhook events when payment states change.
 * This endpoint receives those events, verifies the signature,
 * and updates your database accordingly.
 *
 * Event types we handle:
 *   - incoming_payment.created
 *   - incoming_payment.completed
 *   - outgoing_payment.created
 *   - outgoing_payment.completed
 *   - outgoing_payment.failed
 */

import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { db } from '../config/database';
import { config } from '../config/env';
import { logger } from '../utils/logger';
import { formatCurrency, dollarsToUnits } from '../services/rafikiService';
import { toInputJson } from '../utils/jsonForPrisma';

const router = Router();

// ─── Signature verification ───────────────────────────────────────────────────

function verifyRafikiSignature(rawBody: Buffer, signature: string): boolean {
  const expected = crypto
    .createHmac('sha256', config.rafikiWebhookSecret)
    .update(rawBody)
    .digest('hex');
  const sigHex = signature.replace(/^sha256=/, '');
  // Constant-time comparison
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sigHex, 'hex'));
  } catch {
    return false;
  }
}

// ─── POST /webhooks/rafiki ────────────────────────────────────────────────────

router.post('/rafiki', async (req: Request, res: Response, next: NextFunction) => {
  // req.body is a raw Buffer (set up in index.ts before json middleware)
  const rawBody = req.body as Buffer;
  const signature = req.headers['x-rafiki-signature'] as string ?? '';

  // Verify signature in production
  if (config.isProd && !verifyRafikiSignature(rawBody, signature)) {
    logger.warn('Rafiki webhook: invalid signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  let event: { id: string; type: string; data: Record<string, unknown> };
  try {
    event = JSON.parse(rawBody.toString());
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  logger.info('Rafiki webhook received', { type: event.type, id: event.id });

  // Acknowledge immediately — process async
  res.status(200).json({ received: true });

  // Store event for idempotency and replayability
  const stored = await db.webhookEvent.create({
    data: { eventType: event.type, payload: event.data as any },
  }).catch(() => null);

  if (!stored) return; // Already processed (duplicate)

  try {
    await processEvent(event.type, event.data);
    await db.webhookEvent.update({
      where: { id: stored.id },
      data: { status: 'PROCESSED', processedAt: new Date() },
    });
  } catch (err) {
    logger.error('Webhook processing error', { type: event.type, error: (err as Error).message });
    await db.webhookEvent.update({
      where: { id: stored.id },
      data: { status: 'FAILED', error: (err as Error).message },
    });
  }
});

// ─── Event processors ─────────────────────────────────────────────────────────

async function processEvent(type: string, data: Record<string, unknown>) {
  switch (type) {
    case 'outgoing_payment.completed':
      await handleOutgoingCompleted(data);
      break;
    case 'outgoing_payment.failed':
      await handleOutgoingFailed(data);
      break;
    case 'incoming_payment.completed':
      await handleIncomingCompleted(data);
      break;
    default:
      logger.debug('Unhandled Rafiki event type', { type });
  }
}

async function handleOutgoingCompleted(data: Record<string, unknown>) {
  const ilpId = data.id as string;
  const metadata = (data.metadata ?? {}) as Record<string, string>;
  const paymentId = metadata.quicksendPaymentId;

  if (!paymentId) {
    logger.warn('outgoing_payment.completed: no quicksendPaymentId in metadata', { ilpId });
    return;
  }

  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.status === 'COMPLETED') return;

  const sentAmount = data.sentAmount as { value: string; assetCode: string; assetScale: number };
  const debitAmount = data.debitAmount as { value: string; assetCode: string; assetScale: number };
  const feeCents = BigInt(parseInt(debitAmount.value)) - BigInt(parseInt(sentAmount.value));

  await db.$transaction([
    db.payment.update({
      where: { id: paymentId },
      data: {
        status: 'COMPLETED',
        ilpOutgoingPaymentId: ilpId,
        feeAmountCents: feeCents > 0n ? feeCents : 0n,
        completedAt: new Date(),
      },
    }),
    db.user.update({
      where: { id: payment.senderId },
      data: { balanceCents: { decrement: payment.debitAmountCents } },
    }),
  ]);

  await db.notification.create({
    data: {
      userId: payment.senderId,
      type: 'PAYMENT_SENT',
      title: 'Payment Sent ✓',
      body: `${formatCurrency(sentAmount.value, sentAmount.assetScale, sentAmount.assetCode)} sent to ${payment.recipientName}`,
      data: { paymentId },
    },
  });

  logger.info('Outgoing payment completed (webhook)', { paymentId, ilpId });
}

async function handleOutgoingFailed(data: Record<string, unknown>) {
  const ilpId = data.id as string;
  const metadata = (data.metadata ?? {}) as Record<string, string>;
  const paymentId = metadata.quicksendPaymentId;

  if (!paymentId) return;

  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.status === 'FAILED') return;

  await db.payment.update({
    where: { id: paymentId },
    data: {
      status: 'FAILED',
      failReason: (data.error as string) ?? 'ILP payment failed',
      failedAt: new Date(),
    },
  });

  await db.notification.create({
    data: {
      userId: payment.senderId,
      type: 'PAYMENT_FAILED',
      title: 'Payment Failed',
      body: `Your payment to ${payment.recipientName} could not be completed.`,
      data: toInputJson({ paymentId, error: data.error }),
    },
  });

  logger.warn('Outgoing payment failed (webhook)', { paymentId, ilpId, error: data.error });
}

async function handleIncomingCompleted(data: Record<string, unknown>) {
  const walletAddress = data.walletAddress as string;
  const received = data.receivedAmount as { value: string; assetCode: string; assetScale: number };

  // Find user by wallet address
  const user = await db.user.findUnique({ where: { walletAddress } });
  if (!user) {
    logger.debug('incoming_payment.completed: no user for wallet', { walletAddress });
    return;
  }

  const cents = BigInt(received.value);
  await db.user.update({
    where: { id: user.id },
    data: { balanceCents: { increment: cents } },
  });

  const metadata = (data.metadata ?? {}) as Record<string, string>;
  await db.notification.create({
    data: {
      userId: user.id,
      type: 'PAYMENT_RECEIVED',
      title: 'Money Received 💰',
      body: `You received ${formatCurrency(received.value, received.assetScale, received.assetCode)}`,
      data: { walletAddress, amount: received.value },
    },
  });

  logger.info('Incoming payment completed (webhook)', { userId: user.id, amount: received.value });
}

export default router;
