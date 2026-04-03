import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../config/database';
import { authenticate, requireRole } from '../middleware/auth';
import { requireRouteParam } from '../utils/routeParams';

const router = Router();
router.use(authenticate, requireRole('ADMIN'));

// GET /admin/users
router.get('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '50', search } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = search
      ? { OR: [{ email: { contains: search } }, { firstName: { contains: search } }, { lastName: { contains: search } }] }
      : {};

    const [users, total] = await Promise.all([
      db.user.findMany({ where, skip, take: parseInt(limit), orderBy: { createdAt: 'desc' }, select: { id: true, email: true, firstName: true, lastName: true, kycStatus: true, balanceCents: true, walletAddress: true, isActive: true, createdAt: true } }),
      db.user.count({ where }),
    ]);

    res.json({ data: users.map(u => ({ ...u, balanceCents: Number(u.balanceCents) })), total, page: parseInt(page) });
  } catch (err) { next(err); }
});

// PATCH /admin/users/:id/kyc
router.patch('/users/:id/kyc', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body;
    const id = requireRouteParam(req.params.id);
    const user = await db.user.update({
      where: { id },
      data: { kycStatus: status, kycVerifiedAt: status === 'APPROVED' ? new Date() : null },
      select: { id: true, email: true, kycStatus: true },
    });
    res.json(user);
  } catch (err) { next(err); }
});

// GET /admin/payments
router.get('/payments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, limit = '100' } = req.query as Record<string, string>;
    const payments = await db.payment.findMany({
      where: status ? { status: status as any } : {},
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
      include: { sender: { select: { email: true, firstName: true, lastName: true } } },
    });
    res.json(payments.map(p => ({ ...p, debitAmountCents: Number(p.debitAmountCents), receiveAmountCents: Number(p.receiveAmountCents) })));
  } catch (err) { next(err); }
});

// GET /admin/stats
router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [totalUsers, totalPayments, completedPayments, webhookEvents] = await Promise.all([
      db.user.count(),
      db.payment.count(),
      db.payment.aggregate({ where: { status: 'COMPLETED' }, _sum: { debitAmountCents: true }, _count: true }),
      db.webhookEvent.groupBy({ by: ['status'], _count: true }),
    ]);

    const completedCount =
      typeof completedPayments._count === 'number'
        ? completedPayments._count
        : (completedPayments._count as { _all?: number })?._all ?? 0;

    res.json({
      users: totalUsers,
      payments: { total: totalPayments, completed: completedCount, volume: Number(completedPayments._sum.debitAmountCents ?? 0) },
      webhooks: webhookEvents,
    });
  } catch (err) { next(err); }
});

export default router;
