import { PrismaClient } from '@prisma/client';
import { config } from './env';
import { createJsonDb } from '../jsonDb/jsonDb';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

/** JSON document store (USE_JSON_DB) or Prisma + PostgreSQL. */
export const db = config.useJsonDb
  ? (createJsonDb() as unknown as PrismaClient)
  : global.__prisma ??
    new PrismaClient({
      log: config.isDev ? ['query', 'warn', 'error'] : ['warn', 'error'],
    });

if (config.isDev && !config.useJsonDb) global.__prisma = db as PrismaClient;
