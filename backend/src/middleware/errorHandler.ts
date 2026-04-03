import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';

// ─── Custom Error ──────────────────────────────────────────────────────────────

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code?: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(msg: string, code?: string) {
    return new AppError(400, msg, code);
  }
  static unauthorized(msg = 'Unauthorized') {
    return new AppError(401, msg, 'UNAUTHORIZED');
  }
  static forbidden(msg = 'Forbidden') {
    return new AppError(403, msg, 'FORBIDDEN');
  }
  static notFound(resource = 'Resource') {
    return new AppError(404, `${resource} not found`, 'NOT_FOUND');
  }
  static conflict(msg: string) {
    return new AppError(409, msg, 'CONFLICT');
  }
  static internal(msg = 'Internal server error') {
    return new AppError(500, msg, 'INTERNAL_ERROR');
  }
  static ilpError(msg: string) {
    return new AppError(502, msg, 'ILP_ERROR');
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  // Known app errors
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(err.message, { stack: err.stack, requestId: (req as any).id });
    }
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  // Unknown errors
  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    requestId: (req as any).id,
  });

  res.status(500).json({
    error: 'An unexpected error occurred',
    code: 'INTERNAL_ERROR',
  });
}
