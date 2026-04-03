import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { rafikiService } from '../services/rafikiService';
import { requireRouteParam } from '../utils/routeParams';

const router = Router();
router.use(authenticate);

const contactSchema = z.object({
  name: z.string().min(1).max(100),
  walletAddress: z.string().url(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  notes: z.string().max(300).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  initials: z.string().max(3).optional(),
});

// GET /contacts
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const contacts = await db.contact.findMany({
      where: { userId: (req as AuthRequest).user.id },
      orderBy: { name: 'asc' },
    });
    res.json(contacts);
  } catch (err) { next(err); }
});

// POST /contacts
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).user.id;
    const body = contactSchema.parse(req.body);

    // Validate wallet address
    try {
      await rafikiService.resolveWalletAddress(body.walletAddress);
    } catch {
      throw AppError.badRequest(
        'Could not verify this wallet address. Please check it and try again.',
        'WALLET_RESOLUTION_FAILED'
      );
    }

    const initials = body.initials ??
      body.name.split(' ').map(w => w[0]?.toUpperCase() ?? '').slice(0, 2).join('');

    const contact = await db.contact.create({
      data: { userId, ...body, initials },
    });
    res.status(201).json(contact);
  } catch (err) { next(err); }
});

// PUT /contacts/:id
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).user.id;
    const contactId = requireRouteParam(req.params.id);
    const existing = await db.contact.findFirst({ where: { id: contactId, userId } });
    if (!existing) throw AppError.notFound('Contact');

    const updates = contactSchema.partial().parse(req.body);
    const contact = await db.contact.update({ where: { id: contactId }, data: updates });
    res.json(contact);
  } catch (err) { next(err); }
});

// DELETE /contacts/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthRequest).user.id;
    const contactId = requireRouteParam(req.params.id);
    const existing = await db.contact.findFirst({ where: { id: contactId, userId } });
    if (!existing) throw AppError.notFound('Contact');
    await db.contact.delete({ where: { id: contactId } });
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
