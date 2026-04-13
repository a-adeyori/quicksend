// ─────────────────────────────────────────────────────────────────────────────
// users.ts
// ─────────────────────────────────────────────────────────────────────────────
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { rafikiService } from '../services/rafikiService';
import { formatCurrency } from '../services/rafikiService';
import { requireRouteParam } from '../utils/routeParams';

export const usersRouter = Router();
usersRouter.use(authenticate);

const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  phone: z.string().optional(),
});

const searchSchema = z.object({
  query: z.string().min(2).max(120),
});

// GET /users/profile
usersRouter.get('/profile', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await db.user.findUnique({
      where: { id: (req as AuthRequest).user.id },
      select: {
        id: true, email: true, firstName: true, lastName: true, phone: true,
        walletAddress: true, balanceCents: true, assetCode: true, assetScale: true,
        kycStatus: true, isVerified: true, createdAt: true,
      },
    });
    if (!user) throw AppError.notFound('User');

    res.json({
      ...user,
      balanceCents: Number(user.balanceCents),
      balanceFormatted: formatCurrency(user.balanceCents.toString(), user.assetScale, user.assetCode),
    });
  } catch (err) { next(err); }
});

// PATCH /users/profile
usersRouter.patch('/profile', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updates = updateProfileSchema.parse(req.body);
    const user = await db.user.update({
      where: { id: (req as AuthRequest).user.id },
      data: updates,
      select: { id: true, email: true, firstName: true, lastName: true, phone: true },
    });
    res.json(user);
  } catch (err) { next(err); }
});

// GET /users/search?query=...
// Search app users by name/email for in-app transfers.
usersRouter.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUserId = (req as AuthRequest).user.id;
    const { query } = searchSchema.parse({ query: String(req.query.query ?? '') });

    const rows = await db.user.findMany({
      where: {
        id: { not: authUserId },
        OR: [
          { email: { contains: query, mode: 'insensitive' } },
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        walletAddress: true,
        assetCode: true,
        assetScale: true,
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      users: rows.map((u) => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        walletAddress: u.walletAddress,
        assetCode: u.assetCode,
        assetScale: u.assetScale,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /users/balance
usersRouter.get('/balance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await db.user.findUnique({
      where: { id: (req as AuthRequest).user.id },
      select: { balanceCents: true, assetCode: true, assetScale: true },
    });
    if (!user) throw AppError.notFound('User');

    res.json({
      value: user.balanceCents.toString(),
      assetCode: user.assetCode,
      assetScale: user.assetScale,
      formatted: formatCurrency(user.balanceCents.toString(), user.assetScale, user.assetCode),
    });
  } catch (err) { next(err); }
});

// GET /users/notifications
usersRouter.get('/notifications', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const notifications = await db.notification.findMany({
      where: { userId: (req as AuthRequest).user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(notifications);
  } catch (err) { next(err); }
});

// POST /users/notifications/:id/read
usersRouter.post('/notifications/:id/read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const notifId = requireRouteParam(req.params.id);
    await db.notification.updateMany({
      where: { id: notifId, userId: (req as AuthRequest).user.id },
      data: { isRead: true, readAt: new Date() },
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default usersRouter;
