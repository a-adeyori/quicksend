import fs from 'fs/promises';
import path from 'path';

const KEY = 'quicksend-json-db';

export async function loadRaw(): Promise<string | null> {
  if (process.env.KV_REST_API_URL) {
    const { kv } = await import('@vercel/kv');
    const v = await kv.get<string>(KEY);
    return v ?? null;
  }
  const file = process.env.VERCEL ? path.join('/tmp', 'quicksend-db.json') : path.join(process.cwd(), 'data', 'db.json');
  try {
    return await fs.readFile(file, 'utf8');
  } catch {
    return null;
  }
}

export async function saveRaw(json: string): Promise<void> {
  if (process.env.KV_REST_API_URL) {
    const { kv } = await import('@vercel/kv');
    await kv.set(KEY, json);
    return;
  }
  const file = process.env.VERCEL ? path.join('/tmp', 'quicksend-db.json') : path.join(process.cwd(), 'data', 'db.json');
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, json, 'utf8');
}
