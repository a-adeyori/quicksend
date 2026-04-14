import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { db } from '../config/database';
import { config } from '../config/env';
import { AppError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { rafikiAdminService } from '../services/rafikiAdminService';

const router = Router();

// ─── Schemas ──────────────────────────────────────────────────────────────────

const registerSchema = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-z0-9_]+$/, 'Username may only contain lowercase letters, numbers, and underscores'),
  email: z.string().email(),
  phone: z.preprocess(
    (v) => (v === '' || v === undefined || v === null ? undefined : String(v).trim()),
    z.string().regex(/^\+?[\d\s\-()]{7,20}$/).optional()
  ),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  createWalletAddress: z.boolean().optional().default(true),
});

// Login accepts username OR email
const loginSchema = z.object({
  identifier: z.string().min(1), // email or username
  password: z.string(),
  // legacy: some clients may send `email` directly
  email: z.string().optional(),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

// ─── Token helpers ────────────────────────────────────────────────────────────

function generateAccessToken(userId: string, email: string, role: string) {
  return jwt.sign(
    { sub: userId, email, role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn as any }
  );
}

function generateRefreshToken(userId: string) {
  return jwt.sign(
    { sub: userId, type: 'refresh' },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn as any }
  );
}

function tokenExpiresAt(duration: string): Date {
  const units: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error('Invalid duration: ' + duration);
  const seconds = parseInt(match[1]) * units[match[2]];
  return new Date(Date.now() + seconds * 1000);
}

// ─── POST /auth/register ──────────────────────────────────────────────────────

router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = registerSchema.parse(req.body);

    // Check email uniqueness
    const existingEmail = await db.user.findUnique({ where: { email: body.email } });
    if (existingEmail) throw AppError.conflict('An account with this email already exists');

    // Check username uniqueness
    const existingUsername = await db.user.findUnique({ where: { username: body.username } });
    if (existingUsername) throw AppError.conflict('That username is already taken');

    const passwordHash = await bcrypt.hash(body.password, config.bcryptRounds);

    const user = await db.user.create({
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        username: body.username,
        email: body.email,
        phone: body.phone,
        passwordHash,
        kycStatus: 'APPROVED',
        balanceCents: 10000n, // $100.00 starting balance for beta
        assetCode: 'USD',
        assetScale: 2,
      },
      select: { id: true, email: true, username: true, firstName: true, lastName: true, role: true },
    });

    // Auto-create Rafiki wallet address using username
    let walletAddress: string | null = null;
    if (body.createWalletAddress) {
      try {
        if (config.rafikiWalletAssetId && config.rafikiAdminApiUrl && config.rafikiTenantId && config.rafikiTenantApiSecret) {
          const created = await rafikiAdminService.createWalletAddress({
            publicName: `${user.firstName} ${user.lastName}`.trim(),
            assetId: config.rafikiWalletAssetId,
            username: body.username,
          });
          walletAddress = created.url;
          await db.user.update({
            where: { id: user.id },
            data: {
              walletAddress: created.url,
              ilpAccountId: created.id,
              assetCode: created.asset?.code ?? 'USD',
              assetScale: created.asset?.scale ?? 2,
            },
          });
        }
      } catch (walletErr) {
        logger.warn('User registered but wallet creation failed', {
          userId: user.id,
          error: (walletErr as Error).message,
        });
      }
    }

    const accessToken = generateAccessToken(user.id, user.email, user.role);
    const refreshToken = generateRefreshToken(user.id);

    await db.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: tokenExpiresAt(config.jwt.refreshExpiresIn),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    await db.auditLog.create({
      data: { userId: user.id, action: 'REGISTER', resource: 'user', ipAddress: req.ip },
    });

    logger.info('User registered', { userId: user.id, email: user.email, username: user.username });

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        walletAddress,
      },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /auth/login ─────────────────────────────────────────────────────────

router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const raw = loginSchema.parse(req.body);
    // Support both `identifier` (username or email) and legacy `email` field
    const identifier = (raw.identifier || raw.email || '').trim().toLowerCase();
    const { password } = raw;

    // Look up by email OR username
    const isEmail = identifier.includes('@');
    const user = await (isEmail
      ? db.user.findUnique({
          where: { email: identifier },
          select: { id: true, email: true, username: true, firstName: true, lastName: true, role: true, passwordHash: true, isActive: true },
        })
      : db.user.findUnique({
          where: { username: identifier },
          select: { id: true, email: true, username: true, firstName: true, lastName: true, role: true, passwordHash: true, isActive: true },
        }));

    if (!user || !user.isActive) throw AppError.unauthorized('Invalid username/email or password');

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) throw AppError.unauthorized('Invalid username/email or password');

    const accessToken = generateAccessToken(user.id, user.email, user.role);
    const refreshToken = generateRefreshToken(user.id);

    await db.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: tokenExpiresAt(config.jwt.refreshExpiresIn),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    await db.auditLog.create({
      data: { userId: user.id, action: 'LOGIN', resource: 'user', ipAddress: req.ip },
    });

    logger.info('User logged in', { userId: user.id, username: user.username });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /auth/refresh ───────────────────────────────────────────────────────

router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);

    let payload: { sub: string };
    try {
      payload = jwt.verify(refreshToken, config.jwt.refreshSecret) as typeof payload;
    } catch {
      throw AppError.unauthorized('Invalid or expired refresh token');
    }

    const stored = await db.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: { select: { id: true, email: true, role: true, isActive: true } } },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw AppError.unauthorized('Refresh token revoked or expired');
    }

    if (!stored.user.isActive) throw AppError.unauthorized('Account deactivated');

    const newRefreshToken = generateRefreshToken(stored.user.id);
    await db.$transaction([
      db.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } }),
      db.refreshToken.create({
        data: {
          userId: stored.user.id,
          token: newRefreshToken,
          expiresAt: tokenExpiresAt(config.jwt.refreshExpiresIn),
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        },
      }),
    ]);

    const accessToken = generateAccessToken(stored.user.id, stored.user.email, stored.user.role);
    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (err) {
    next(err);
  }
});

// ─── POST /auth/logout ────────────────────────────────────────────────────────

router.post('/logout', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await db.refreshToken.updateMany({
        where: { token: refreshToken, userId: (req as AuthRequest).user.id },
        data: { revokedAt: new Date() },
      });
    }
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
});

// ─── GET /auth/me ──────────────────────────────────────────────────────────────

router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await db.user.findUnique({
      where: { id: (req as AuthRequest).user.id },
      select: {
        id: true, email: true, username: true, firstName: true, lastName: true,
        phone: true, role: true, kycStatus: true, walletAddress: true,
        balanceCents: true, assetCode: true, assetScale: true,
        isVerified: true, createdAt: true,
      },
    });
    if (!user) throw AppError.notFound('User');
    res.json({
      ...user,
      balanceCents: user.balanceCents.toString(),
    });
  } catch (err) {
    next(err);
  }
});

export default router;