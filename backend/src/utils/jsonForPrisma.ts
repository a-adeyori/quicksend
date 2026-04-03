import { Prisma } from '@prisma/client';

/** Coerce unknown webhook/API payloads into Prisma `Json` input. */
export function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
