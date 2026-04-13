# QuickSend — reviewer & submission notes

Use this for **Casey (live testing)** and **Dr. Pearson (code review)**.

## Repository layout (single project root)

Everything for Vercel + local dev lives in **one folder** (the repo root):

| Path | What it is |
|------|------------|
| `app/`, `src/`, `package.json`, `vercel.json` | Expo web + mobile app |
| `backend/` | Node API (Prisma, Docker) |
| `docker-compose.yml` | Local Postgres + Redis + API |

On **Vercel**, connect this repo and leave **Root Directory empty** (use the repository root — the folder that directly contains `app/` and `vercel.json`).

---

## 0. You don’t have a deployed API yet — pick a path

### Option A — Live **web demo only** (no backend hosting)

This is valid for showing the **UI** and **offline interactive demo** (simulated wallet, no server sign-in).

1. Deploy the **web** app to Vercel with **Root Directory** = *(empty — repository root)*.
2. Set **only** these (Production env):

   | Variable | Value |
   |----------|--------|
   | `EXPO_PUBLIC_FRONTEND_ONLY` | `true` |
   | `EXPO_PUBLIC_DEMO_MODE` | `true` |
   | `EXPO_PUBLIC_USE_LIVE_AUTH` | `false` |

3. Share the Vercel URL. Reviewers use **Welcome → Try demo**; data stays in the browser.

**What to say to Casey:** the link is a **client-only sandbox** (no hosted API). **Dr. Pearson** still gets the repo, including `backend/` and Docker Compose for **local** API + DB. If they need a **hosted** login + ILP-backed flows, use Option B when you can.

---

### Option B — Add a **hosted API** later (real login + seed account)

Roughly: **PostgreSQL** + run this repo’s **backend** (`backend/Dockerfile` already runs `prisma migrate deploy` then the server).

Free/low-friction hosts people use: **Railway**, **Render**, **Fly.io**.

1. Create a **Postgres** database; copy its `DATABASE_URL`.
2. Deploy the **`backend`** folder (Dockerfile) or `npm start` after `npm run build` with the same env as `backend/.env.example` (JWT, `RAFIKI_*`, `CORS_ORIGINS` = your **Vercel web URL**, etc.).
3. One-time: run **`npx prisma db seed`** against that DB (or use a release command that runs seed — many teams run seed manually once).
4. Point the web app at the API:

   - `EXPO_PUBLIC_FRONTEND_ONLY=false`
   - `EXPO_PUBLIC_USE_LIVE_AUTH=true`
   - `EXPO_PUBLIC_API_URL=https://<your-api-host>/api/v1`

Then **Casey** can use the seeded account in **§3**.

If you want auto wallet creation in Rafiki (instead of manual copy/paste wallet URLs), also set:

- `RAFIKI_ADMIN_API_URL` (tenant GraphQL admin endpoint)
- `RAFIKI_TENANT_ID`
- `RAFIKI_TENANT_API_SECRET`
- `RAFIKI_WALLET_ASSET_ID`

Then the app can call **`POST /wallet/create-address`** and create a user wallet address on sign-up / settings.

---

## 1. Live app **with** a deployed API (full testing)

Deploy the **web** build to Vercel (or Netlify / Cloudflare Pages):

1. Connect this repo; **Root Directory** = repo root (folder containing `app/`, `package.json`, `vercel.json`).
2. **Environment variables** (Production) — copy from `.env.example` and set at least:
   - `EXPO_PUBLIC_FRONTEND_ONLY=false`
   - `EXPO_PUBLIC_DEMO_MODE=true`
   - `EXPO_PUBLIC_USE_LIVE_AUTH=true`
   - `EXPO_PUBLIC_API_URL=https://<your-api-host>/api/v1` (HTTPS URL of your deployed backend)
   - `EXPO_PUBLIC_RAFIKI_*` — same tenant URLs as in `backend/.env` / `.env.example`
3. Redeploy after env changes.

The included `vercel.json` runs `npx expo export -p web` and publishes the `dist/` folder.

**Share the Vercel URL** with Casey for click-through testing.

## 2. Backend API (sandbox)

- **PostgreSQL + Redis** — e.g. Docker locally (`docker compose` from the repo) or a hosted DB on Railway / Render / Fly.io.
- **Rafiki / ILP** — use **testnet / sandbox** URLs in `backend/.env` (`RAFIKI_*`). No real money.
- After deploy: run migrations and seed:

  ```bash
  cd backend
  npx prisma migrate deploy
  npx prisma db seed
  ```

- **CORS** — add your deployed web origin to `CORS_ORIGINS` in `backend/.env` (e.g. `https://your-app.vercel.app`).

Plaid (or other banking aggregators) are **not** wired in this repo yet; the MVP is **ILP / Open Payments via Rafiki** on sandbox. If you add Plaid later, use **sandbox** keys only.

## 3. Pre-verified demo account (Casey)

**Only when the API is running** (Option B, or local Docker in §5). Option A (frontend-only Vercel) does **not** use this login — there is no server.

After `npx prisma db seed`:

| Field    | Value              |
|----------|--------------------|
| Email    | `demo@quicksend.app` |
| Password | `password123`        |

This user has **KYC = APPROVED** and a **simulated balance** so you can reach **Send** and **ILP flows** without going through KYC onboarding. Connect a **testnet wallet** in Settings when demonstrating real ILP movement against Rafiki sandbox.

## 4. Packaged code (Dr. Pearson)

Share the **Git repository** (or a zip of the project). Highlight:

- Repo root — Expo app (`app/`, `src/`, `package.json`)
- `backend/` — API (`src/`, `prisma/`)

## 5. Quick local smoke test

```bash
# Terminal A — API + DB (from repo folder that contains docker-compose.yml)
docker compose up -d

# Terminal B — seed (first time)
cd backend && npx prisma db seed

# Terminal C — web app (repo root)
npm ci && npm run web:lan
```

Open the LAN URL shown by Expo, sign in with the table above, and exercise Send / Settings.

---

*Sandbox only — no production financial advice or real funds.*
