import { Request, Response, NextFunction } from 'express';

export function requestId(req: Request, res: Response, next: NextFunction) {
  (req as any).id = crypto.randomUUID();
  res.setHeader('X-Request-ID', (req as any).id);
  next();
}
