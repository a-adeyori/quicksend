import { randomUUID } from 'crypto';
import { loadRaw, saveRaw } from './persist';

/** In-memory DB; persisted as one JSON blob (file locally, Vercel KV when configured). */
interface Store {
  users: Record<string, unknown>[];
  refreshTokens: Record<string, unknown>[];
  auditLogs: Record<string, unknown>[];
  payments: Record<string, unknown>[];
  contacts: Record<string, unknown>[];
  notifications: Record<string, unknown>[];
  webhookEvents: Record<string, unknown>[];
}

function emptyStore(): Store {
  return {
    users: [],
    refreshTokens: [],
    auditLogs: [],
    payments: [],
    contacts: [],
    notifications: [],
    webhookEvents: [],
  };
}

let store: Store = emptyStore();
let loaded = false;

class Mutex {
  private chain = Promise.resolve();
  runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.chain.then(fn);
    this.chain = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }
}

const mutex = new Mutex();

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  const raw = await loadRaw();
  if (raw) {
    try {
      store = { ...emptyStore(), ...JSON.parse(raw) };
      for (const k of Object.keys(emptyStore()) as (keyof Store)[]) {
        if (!Array.isArray(store[k])) store[k] = [];
      }
    } catch {
      store = emptyStore();
    }
  } else {
    store = emptyStore();
  }
  loaded = true;
}

async function persist(): Promise<void> {
  await saveRaw(JSON.stringify(store));
}

function iso(d: Date | string): string {
  return d instanceof Date ? d.toISOString() : String(d);
}

function toBigInt(v: unknown): bigint {
  if (typeof v === 'bigint') return v;
  if (typeof v === 'number') return BigInt(Math.trunc(v));
  return BigInt(String(v ?? '0'));
}

function matchField(cell: unknown, val: unknown): boolean {
  if (val !== null && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
    const o = val as Record<string, unknown>;
    if ('contains' in o && typeof o.contains === 'string') {
      const s = String(cell ?? '');
      return s.toLowerCase().includes(String(o.contains).toLowerCase());
    }
  }
  return cell === val;
}

/** Prisma-style where: top-level keys AND together; OR is one alternative branch (combined with other keys). */
function matchesWhere(row: Record<string, unknown>, where: Record<string, unknown> | undefined): boolean {
  if (!where || Object.keys(where).length === 0) return true;
  const { OR, AND, NOT, ...rest } = where;
  if (NOT && matchesWhere(row, NOT as Record<string, unknown>)) return false;
  for (const [key, val] of Object.entries(rest)) {
    if (!matchField(row[key], val)) return false;
  }
  if (OR && Array.isArray(OR)) {
    if (!OR.some((w: Record<string, unknown>) => matchesWhere(row, w))) return false;
  }
  if (AND && Array.isArray(AND)) {
    if (!AND.every((w: Record<string, unknown>) => matchesWhere(row, w))) return false;
  }
  return true;
}

function pick<T extends Record<string, unknown>>(row: T, select: Record<string, boolean> | undefined): Partial<T> {
  if (!select) return { ...row };
  const out: Partial<T> = {};
  for (const k of Object.keys(select)) {
    if (select[k]) (out as Record<string, unknown>)[k] = row[k as keyof T];
  }
  return out;
}

function applyScalarUserData(u: Record<string, unknown>, data: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(data)) {
    if (v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
      const o = v as Record<string, unknown>;
      if ('increment' in o) {
        const cur = toBigInt(u.balanceCents);
        u.balanceCents = (cur + toBigInt(o.increment)).toString();
        continue;
      }
      if ('decrement' in o) {
        const cur = toBigInt(u.balanceCents);
        u.balanceCents = (cur - toBigInt(o.decrement)).toString();
        continue;
      }
    }
    if (k === 'balanceCents' || k === 'debitAmountCents' || k === 'receiveAmountCents' || k === 'feeAmountCents') {
      u[k] = typeof v === 'bigint' ? v.toString() : String(v);
    } else if (v instanceof Date) {
      u[k] = v.toISOString();
    } else if (v === null) {
      u[k] = null;
    } else {
      u[k] = v as unknown;
    }
  }
  u.updatedAt = new Date().toISOString();
}

async function withStore<T>(fn: (s: Store) => Promise<T>): Promise<T> {
  return mutex.runExclusive(async () => {
    await ensureLoaded();
    return fn(store);
  });
}

/** Map stored user row to API shape (bigint balance). */
function mapUser(row: Record<string, unknown>, select?: Record<string, boolean>): Record<string, unknown> {
  const r = { ...row };
  if (r.balanceCents !== undefined) r.balanceCents = toBigInt(r.balanceCents);
  if (r.createdAt && typeof r.createdAt === 'string') r.createdAt = new Date(r.createdAt);
  if (r.updatedAt && typeof r.updatedAt === 'string') r.updatedAt = new Date(r.updatedAt);
  if (r.kycVerifiedAt && typeof r.kycVerifiedAt === 'string') r.kycVerifiedAt = new Date(r.kycVerifiedAt);
  if (select) return pick(r as Record<string, unknown>, select) as Record<string, unknown>;
  return r;
}

function mapPayment(row: Record<string, unknown>): Record<string, unknown> {
  const r = { ...row };
  for (const f of ['debitAmountCents', 'receiveAmountCents', 'feeAmountCents']) {
    if (r[f] !== undefined) r[f] = toBigInt(r[f]);
  }
  for (const f of ['initiatedAt', 'processedAt', 'completedAt', 'failedAt', 'createdAt', 'updatedAt']) {
    if (r[f] && typeof r[f] === 'string') r[f] = new Date(r[f] as string);
  }
  return r;
}

export function createJsonDb() {
  const user = {
    async findUnique(args: {
      where: Record<string, unknown>;
      select?: Record<string, boolean>;
    }): Promise<Record<string, unknown> | null> {
      return withStore(async (s) => {
        const row = s.users.find((u) => matchesWhere(u as Record<string, unknown>, args.where));
        if (!row) return null;
        return mapUser(row as Record<string, unknown>, args.select);
      });
    },

    async findFirst(args: { where: Record<string, unknown> }): Promise<Record<string, unknown> | null> {
      return withStore(async (s) => {
        const row = s.users.find((u) => matchesWhere(u as Record<string, unknown>, args.where));
        return row ? mapUser(row as Record<string, unknown>) : null;
      });
    },

    async findMany(args: {
      where?: Record<string, unknown>;
      skip?: number;
      take?: number;
      orderBy?: Record<string, string>;
      select?: Record<string, boolean>;
    }): Promise<Record<string, unknown>[]> {
      return withStore(async (s) => {
        let rows = s.users.filter((u) => matchesWhere(u as Record<string, unknown>, args.where ?? {}));
        const ob = args.orderBy;
        if (ob?.createdAt) {
          rows = [...rows].sort((a, b) => {
            const ta = new Date(String((a as Record<string, unknown>).createdAt)).getTime();
            const tb = new Date(String((b as Record<string, unknown>).createdAt)).getTime();
            return ob.createdAt === 'desc' ? tb - ta : ta - tb;
          });
        }
        if (args.skip) rows = rows.slice(args.skip);
        if (args.take !== undefined) rows = rows.slice(0, args.take);
        return rows.map((r) => mapUser(r as Record<string, unknown>, args.select));
      });
    },

    async count(args?: { where?: Record<string, unknown> }): Promise<number> {
      return withStore(async (s) => {
        return s.users.filter((u) => matchesWhere(u as Record<string, unknown>, args?.where ?? {})).length;
      });
    },

    async create(args: { data: Record<string, unknown>; select?: Record<string, boolean> }): Promise<Record<string, unknown>> {
      return withStore(async (s) => {
        const id = randomUUID();
        const now = new Date().toISOString();
        const row: Record<string, unknown> = {
          id,
          ...args.data,
          balanceCents:
            args.data.balanceCents !== undefined ? String(args.data.balanceCents) : '0',
          role: args.data.role ?? 'USER',
          isVerified: args.data.isVerified ?? false,
          isActive: args.data.isActive ?? true,
          kycStatus: args.data.kycStatus ?? 'PENDING',
          assetCode: args.data.assetCode ?? 'USD',
          assetScale: args.data.assetScale ?? 2,
          createdAt: now,
          updatedAt: now,
        };
        s.users.push(row);
        await persist();
        return mapUser(row, args.select) as Record<string, unknown>;
      });
    },

    async update(args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
      select?: Record<string, boolean>;
    }): Promise<Record<string, unknown>> {
      return withStore(async (s) => {
        const idx = s.users.findIndex((u) => matchesWhere(u as Record<string, unknown>, args.where));
        if (idx < 0) throw new Error('Record not found');
        const row = s.users[idx] as Record<string, unknown>;
        applyScalarUserData(row, args.data);
        await persist();
        return mapUser(row, args.select);
      });
    },
  };

  const refreshToken = {
    async create(args: { data: Record<string, unknown> }): Promise<Record<string, unknown>> {
      return withStore(async (s) => {
        const id = randomUUID();
        const row = {
          id,
          ...args.data,
          expiresAt: iso(args.data.expiresAt as Date),
          revokedAt: args.data.revokedAt ? iso(args.data.revokedAt as Date) : null,
          createdAt: new Date().toISOString(),
        };
        s.refreshTokens.push(row);
        await persist();
        return row;
      });
    },

    async findUnique(args: {
      where: Record<string, unknown>;
      include?: { user: { select: Record<string, boolean> } };
    }): Promise<Record<string, unknown> | null> {
      return withStore(async (s) => {
        const row = s.refreshTokens.find((t) => matchesWhere(t as Record<string, unknown>, args.where));
        if (!row) return null;
        const out = { ...row } as Record<string, unknown>;
        if (args.include?.user) {
          const uid = out.userId as string;
          const ur = s.users.find((u) => (u as Record<string, unknown>).id === uid);
          if (ur) {
            out.user = pick(ur as Record<string, unknown>, args.include.user.select);
            out.user = mapUser(out.user as Record<string, unknown>);
          }
        }
        if (out.expiresAt) out.expiresAt = new Date(String(out.expiresAt));
        if (out.revokedAt) out.revokedAt = new Date(String(out.revokedAt));
        return out;
      });
    },

    async update(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<Record<string, unknown>> {
      return withStore(async (s) => {
        const idx = s.refreshTokens.findIndex((t) => matchesWhere(t as Record<string, unknown>, args.where));
        if (idx < 0) throw new Error('Record not found');
        const row = s.refreshTokens[idx] as Record<string, unknown>;
        Object.assign(row, args.data);
        if (args.data.revokedAt) row.revokedAt = iso(args.data.revokedAt as Date);
        await persist();
        return row;
      });
    },

    async updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }> {
      return withStore(async (s) => {
        let n = 0;
        for (const t of s.refreshTokens) {
          if (matchesWhere(t as Record<string, unknown>, args.where)) {
            Object.assign(t, args.data);
            if (args.data.revokedAt) (t as Record<string, unknown>).revokedAt = iso(args.data.revokedAt as Date);
            n++;
          }
        }
        await persist();
        return { count: n };
      });
    },
  };

  const auditLog = {
    async create(args: { data: Record<string, unknown> }): Promise<void> {
      return withStore(async (s) => {
        s.auditLogs.push({
          id: randomUUID(),
          ...args.data,
          createdAt: new Date().toISOString(),
        });
        await persist();
      });
    },
  };

  const payment = {
    async findMany(args: {
      where: Record<string, unknown>;
      take?: number;
      skip?: number;
      cursor?: { id: string };
      orderBy?: Record<string, string>;
      select?: Record<string, boolean>;
      include?: { sender: { select: Record<string, boolean> } };
    }): Promise<Record<string, unknown>[]> {
      return withStore(async (s) => {
        let rows = s.payments.filter((p) => matchesWhere(p as Record<string, unknown>, args.where));
        const ob = args.orderBy;
        if (ob?.createdAt) {
          rows = [...rows].sort((a, b) => {
            const ta = new Date(String((a as Record<string, unknown>).createdAt)).getTime();
            const tb = new Date(String((b as Record<string, unknown>).createdAt)).getTime();
            return ob.createdAt === 'desc' ? tb - ta : ta - tb;
          });
        }
        if (args.cursor?.id) {
          const i = rows.findIndex((r) => (r as Record<string, unknown>).id === args.cursor!.id);
          rows = i >= 0 ? rows.slice(i + 1) : [];
        }
        if (args.skip) rows = rows.slice(args.skip);
        if (args.take !== undefined) rows = rows.slice(0, args.take);
        return rows.map((row) => {
          let r = mapPayment(row as Record<string, unknown>);
          if (args.select) r = pick(r as Record<string, unknown>, args.select) as Record<string, unknown>;
          if (args.include?.sender) {
            const sid = r.senderId as string;
            const su = s.users.find((u) => (u as Record<string, unknown>).id === sid);
            if (su) {
              (r as Record<string, unknown>).sender = pick(su as Record<string, unknown>, args.include.sender.select);
            }
          }
          return r;
        });
      });
    },

    async findUnique(args: { where: Record<string, unknown> }): Promise<Record<string, unknown> | null> {
      return withStore(async (s) => {
        const row = s.payments.find((p) => matchesWhere(p as Record<string, unknown>, args.where));
        return row ? mapPayment(row as Record<string, unknown>) : null;
      });
    },

    async findFirst(args: { where: Record<string, unknown> }): Promise<Record<string, unknown> | null> {
      return withStore(async (s) => {
        const row = s.payments.find((p) => matchesWhere(p as Record<string, unknown>, args.where));
        return row ? mapPayment(row as Record<string, unknown>) : null;
      });
    },

    async create(args: { data: Record<string, unknown> }): Promise<Record<string, unknown>> {
      return withStore(async (s) => {
        const id = randomUUID();
        const now = new Date().toISOString();
        const row: Record<string, unknown> = {
          id,
          reference: randomUUID().replace(/-/g, '').slice(0, 24),
          ...args.data,
          debitAmountCents: String(args.data.debitAmountCents),
          receiveAmountCents: String(args.data.receiveAmountCents),
          feeAmountCents: String(args.data.feeAmountCents ?? 0),
          status: args.data.status ?? 'PENDING',
          createdAt: now,
          updatedAt: now,
          initiatedAt: now,
        };
        s.payments.push(row);
        await persist();
        return mapPayment(row);
      });
    },

    async update(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<Record<string, unknown>> {
      return withStore(async (s) => {
        const idx = s.payments.findIndex((p) => matchesWhere(p as Record<string, unknown>, args.where));
        if (idx < 0) throw new Error('Record not found');
        const row = s.payments[idx] as Record<string, unknown>;
        for (const [k, v] of Object.entries(args.data)) {
          if (v instanceof Date) {
            row[k] = v.toISOString();
          } else if (typeof v === 'bigint') {
            row[k] = v.toString();
          } else {
            row[k] = v as unknown;
          }
        }
        row.updatedAt = new Date().toISOString();
        await persist();
        return mapPayment(row);
      });
    },

    async count(args?: { where?: Record<string, unknown> }): Promise<number> {
      return withStore(async (s) => {
        return s.payments.filter((p) => matchesWhere(p as Record<string, unknown>, args?.where ?? {})).length;
      });
    },

    async aggregate(args: {
      where?: Record<string, unknown>;
      _sum?: Record<string, boolean>;
      _count?: boolean | Record<string, unknown>;
    }): Promise<{ _sum: Record<string, unknown>; _count: { _all: number } }> {
      return withStore(async (s) => {
        const rows = s.payments.filter((p) => matchesWhere(p as Record<string, unknown>, args.where ?? {}));
        const _sum: Record<string, unknown> = {};
        if (args._sum?.debitAmountCents) {
          _sum.debitAmountCents = rows.reduce(
            (acc, p) => acc + toBigInt((p as Record<string, unknown>).debitAmountCents),
            0n
          );
        }
        if (args._sum?.receiveAmountCents) {
          _sum.receiveAmountCents = rows.reduce(
            (acc, p) => acc + toBigInt((p as Record<string, unknown>).receiveAmountCents),
            0n
          );
        }
        return { _sum, _count: { _all: rows.length } };
      });
    },
  };

  const contact = {
    async findMany(args: { where: Record<string, unknown>; orderBy?: Record<string, string> }): Promise<Record<string, unknown>[]> {
      return withStore(async (s) => {
        let rows = s.contacts.filter((c) => matchesWhere(c as Record<string, unknown>, args.where));
        if (args.orderBy?.name) {
          rows = [...rows].sort((a, b) =>
            String((a as Record<string, unknown>).name).localeCompare(String((b as Record<string, unknown>).name))
          );
        }
        return rows;
      });
    },

    async findFirst(args: { where: Record<string, unknown> }): Promise<Record<string, unknown> | null> {
      return withStore(async (s) => {
        return s.contacts.find((c) => matchesWhere(c as Record<string, unknown>, args.where)) ?? null;
      });
    },

    async create(args: { data: Record<string, unknown> }): Promise<Record<string, unknown>> {
      return withStore(async (s) => {
        const row = { id: randomUUID(), ...args.data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        s.contacts.push(row);
        await persist();
        return row;
      });
    },

    async update(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<Record<string, unknown>> {
      return withStore(async (s) => {
        const idx = s.contacts.findIndex((c) => matchesWhere(c as Record<string, unknown>, args.where));
        if (idx < 0) throw new Error('Record not found');
        Object.assign(s.contacts[idx], args.data, { updatedAt: new Date().toISOString() });
        await persist();
        return s.contacts[idx] as Record<string, unknown>;
      });
    },

    async delete(args: { where: Record<string, unknown> }): Promise<void> {
      return withStore(async (s) => {
        const idx = s.contacts.findIndex((c) => matchesWhere(c as Record<string, unknown>, args.where));
        if (idx >= 0) {
          s.contacts.splice(idx, 1);
          await persist();
        }
      });
    },
  };

  const notification = {
    async findMany(args: { where: Record<string, unknown>; orderBy?: Record<string, string>; take?: number }): Promise<unknown[]> {
      return withStore(async (s) => {
        let rows = s.notifications.filter((n) => matchesWhere(n as Record<string, unknown>, args.where));
        if (args.orderBy?.createdAt === 'desc') {
          rows = [...rows].sort(
            (a, b) =>
              new Date(String((b as Record<string, unknown>).createdAt)).getTime() -
              new Date(String((a as Record<string, unknown>).createdAt)).getTime()
          );
        }
        if (args.take) rows = rows.slice(0, args.take);
        return rows;
      });
    },

    async create(args: { data: Record<string, unknown> }): Promise<void> {
      return withStore(async (s) => {
        s.notifications.push({
          id: randomUUID(),
          ...args.data,
          createdAt: new Date().toISOString(),
        });
        await persist();
      });
    },

    async updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<void> {
      return withStore(async (s) => {
        for (const n of s.notifications) {
          if (matchesWhere(n as Record<string, unknown>, args.where)) {
            Object.assign(n, args.data);
            if (args.data.readAt) (n as Record<string, unknown>).readAt = iso(args.data.readAt as Date);
          }
        }
        await persist();
      });
    },
  };

  const webhookEvent = {
    async create(args: { data: Record<string, unknown> }): Promise<Record<string, unknown>> {
      return withStore(async (s) => {
        const row = {
          id: randomUUID(),
          ...args.data,
          payload: args.data.payload,
          status: args.data.status ?? 'PENDING',
          retries: args.data.retries ?? 0,
          createdAt: new Date().toISOString(),
        };
        s.webhookEvents.push(row);
        await persist();
        return row;
      });
    },

    async update(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<void> {
      return withStore(async (s) => {
        const row = s.webhookEvents.find((w) => matchesWhere(w as Record<string, unknown>, args.where));
        if (row) {
          Object.assign(row, args.data);
          if (args.data.processedAt) (row as Record<string, unknown>).processedAt = iso(args.data.processedAt as Date);
          await persist();
        }
      });
    },

    async groupBy(args: {
      by: string[];
      _count: boolean;
    }): Promise<{ status: string; _count: { _all: number } }[]> {
      return withStore(async (s) => {
        const by = args.by[0];
        const map = new Map<string, number>();
        for (const w of s.webhookEvents) {
          const k = String((w as Record<string, unknown>)[by] ?? '');
          map.set(k, (map.get(k) ?? 0) + 1);
        }
        return [...map.entries()].map(([status, n]) => ({ status, _count: { _all: n } }));
      });
    },
  };

  async function $transaction<T>(ops: Promise<T>[]): Promise<T[]> {
    const out: T[] = [];
    for (const p of ops) {
      out.push(await p);
    }
    return out;
  }

  return {
    user,
    refreshToken,
    auditLog,
    payment,
    contact,
    notification,
    webhookEvent,
    $transaction,
  };
}

export type JsonDb = ReturnType<typeof createJsonDb>;
