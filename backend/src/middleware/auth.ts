import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { db } from '../config/database';
import { AppError } from './errorHandler';

export interface AuthRequest extends Request {
  user: {
    id: string;
    email: string;
    role: string;
  };
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw AppError.unauthorized('Missing or malformed Authorization header');
    }

    const token = authHeader.slice(7);
    let payload: { sub: string; email: string; role: string };

    try {
      payload = jwt.verify(token, config.jwt.secret) as typeof payload;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw AppError.unauthorized('Token expired');
      }
      throw AppError.unauthorized('Invalid token');
    }

    // Verify user still exists and is active
    const user = await db.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw AppError.unauthorized('Account not found or deactivated');
    }

    (req as AuthRequest).user = { id: user.id, email: user.email, role: user.role };
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = (req as AuthRequest).user;
    if (!user || !roles.includes(user.role)) {
      return next(AppError.forbidden('Insufficient permissions'));
    }
    next();
  };
}

export function requestId(req: Request, res: Response, next: NextFunction) {
  (req as any).id = crypto.randomUUID();
  res.setHeader('X-Request-ID', (req as any).id);
  next();
}
