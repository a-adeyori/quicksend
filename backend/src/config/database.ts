import { PrismaClient } from '@prisma/client';
import { config } from './env';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

// Prevent multiple instances in development (hot reload)
export const db: PrismaClient =
  global.__prisma ??
  new PrismaClient({
    log: config.isDev ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });

if (config.isDev) global.__prisma = db;
