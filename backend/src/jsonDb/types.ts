/** Mirrors Prisma enums for routes that import PaymentStatus without Prisma. */
export type PaymentStatus =
  | 'PENDING'
  | 'QUOTING'
  | 'QUOTED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'REVERSED';

export const PaymentStatusValues: PaymentStatus[] = [
  'PENDING',
  'QUOTING',
  'QUOTED',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'REVERSED',
];
