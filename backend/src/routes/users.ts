import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { formatCurrency } from '../services/rafikiService';
import { requireRouteParam } from '../utils/routeParams';

export const usersRouter = Router();
usersRouter.use(authenticate);

const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  phone: z.string().optional(),
});

// ─── GET /users/search?q=yori ─────────────────────────────────────────────────
// Search by username (primary), name, or email.
// Returns only enough info for the send money UI.
usersRouter.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = (req.query.q as string ?? '').trim().toLowerCase();
    if (q.length < 2) {
      res.json({ users: [] });
      return;
    }

    const userId = (req as AuthRequest).user.id;

    const users = await db.user.findMany({
      where: {
        AND: [
          { id: { not: userId } },
          { isActive: true },
          {
            OR: [
              { username: { contains: q, mode: 'insensitive' } },
              { firstName: { contains: q, mode: 'insensitive' } },
              { lastName: { contains: q, mode: 'insensitive' } },
            ],
          },
        ],
      },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        walletAddress: true,
        assetCode: true,
        assetScale: true,
      },
      take: 10,
      orderBy: { username: 'asc' },
    });

    res.json({
      users: users.map(u => ({
        id: u.id,
        username: u.username,
        name: `${u.firstName} ${u.lastName}`.trim(),
        walletAddress: u.walletAddress,
        assetCode: u.assetCode,
        assetScale: u.assetScale,
        initials: `${u.firstName[0]}${u.lastName[0]}`.toUpperCase(),
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /users/profile ─────────────────────────────────────────────────────
usersRouter.patch('/profile', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updates = updateProfileSchema.parse(req.body);
    const user = await db.user.update({
      where: { id: (req as AuthRequest).user.id },
      data: updates,
      select: { id: true, email: true, username: true, firstName: true, lastName: true, phone: true },
    });
    res.json(user);
  } catch (err) { next(err); }
});

// ─── GET /users/balance ───────────────────────────────────────────────────────
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

// ─── GET /users/notifications ─────────────────────────────────────────────────
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

// ─── POST /users/notifications/:id/read ──────────────────────────────────────
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