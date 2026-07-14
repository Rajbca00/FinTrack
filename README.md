# FinTrack

A personal finance manager for tracking bank accounts and credit cards, importing
statements, auto-categorizing transactions, and reporting on spending — including
support for a single account that holds money for more than one purpose (e.g. your
own funds and a temple/trust fund you manage, inside the same ICICI account).

## Features

- **Accounts**: bank accounts and credit cards, each with its own currency and (for
  cards) credit limit.
- **Multi-purpose accounts**: every account has one or more **Groups** (funds/flags).
  A single account can be split into groups such as "Personal" and "Temple Fund" —
  each group tracks its own balance and transaction list, while the account's total
  balance is always the sum of its groups.
- **Statement import**: upload a CSV export from your bank or credit card. The
  importer suggests a column mapping (date/description/debit/credit or a single
  signed amount column), previews the rows, and skips duplicates on re-import.
- **Auto-categorization rules**: pattern-matching rules (contains/starts-with/regex/
  exact, optionally restricted to money-in or money-out) assign a category
  automatically on import or manual entry. Rules can be re-applied later to
  existing uncategorized transactions.
- **Manual edit**: every transaction's date, description, amount, category, group,
  and notes can be edited after the fact.
- **Custom categories**: add/edit/remove your own categories in addition to the
  seeded defaults.
- **Transfers**:
  - *Account to account* — moves real money between two accounts (e.g. paying a
    credit card from a savings account).
  - *Reallocation* — moves money between two groups inside the **same** account
    (e.g. Personal → Temple Fund), net-zero at the account level but changes each
    group's balance.
- **Reporting**: weekly / monthly / annual income vs. expense trend and a
  spending-by-category breakdown, filterable by account and group, plus a live
  balance view per account and per group.

## Stack

- `server/`: Node.js, Express, TypeScript, Prisma (PostgreSQL), zod.
- `client/`: React, TypeScript, Vite, Tailwind CSS v4, TanStack Query, Recharts.

In production, the server also serves the built client as static files (plus a
SPA fallback), so the whole app is one Node web service - see **Deployment** below.
There's also a Vercel-native deployment (static client + serverless API) - see
**Deployment (Vercel + Neon)** below.

## Getting started (local development)

You need a Postgres database to point at. The quickest option locally is Docker:
`docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16`, or install
Postgres directly. A free hosted Postgres (e.g. [Neon](https://neon.tech)) also
works fine for local dev - just put its connection string in `.env`.

### 1. Server

```bash
cd server
npm install
cp .env.example .env       # then edit DATABASE_URL to point at your Postgres
npx prisma migrate dev     # applies the schema
npx tsx prisma/seed.ts     # seeds default categories and auto-categorization rules
npm run dev                # starts the API on http://localhost:4000
```

`BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD_HASH` can be left blank in `.env` for
local dev - the auth gate only enforces itself when `NODE_ENV=production`.

### 2. Client

```bash
cd client
npm install
npm run dev               # starts the app on http://localhost:5173
```

The client dev server proxies `/api` requests to `http://localhost:4000`, so run
both at once.

### Resetting the database

`npx prisma migrate reset` (from `server/`) drops and recreates all tables, then
you'll need to re-run the seed script.

## Deployment (Render + Neon, both free)

This app is one Node web service (API + static frontend) backed by Postgres.
Render's free web-service plan has no persistent disk, and its free Postgres
expires after 30 days - so the database lives on [Neon](https://neon.tech)
instead, which has a free tier that persists indefinitely.

### 1. Create the database (Neon)

1. Sign up at [neon.tech](https://neon.tech) and create a project.
2. Copy the connection string it gives you (starts with `postgresql://...`,
   include `?sslmode=require`).

### 2. Generate your login credentials

The whole app is gated behind a single shared username/password (HTTP Basic
Auth), since it holds real financial data and will be reachable at a public
URL. Pick a password and hash it:

```bash
cd server
npm run hash-password -- "your-password-here"
```

Keep the printed hash - you'll paste it into Render as `BASIC_AUTH_PASSWORD_HASH`.

### 3. Deploy (Render)

1. Push this repo to GitHub (already done if you're reading this from the repo).
2. In the Render dashboard: **New → Blueprint**, point it at this repo. Render
   will read `render.yaml` at the repo root and configure the service
   automatically (free plan, build command, start command, health check).
3. When prompted for the env vars marked `sync: false`, fill in:
   - `DATABASE_URL` - the Neon connection string from step 1
   - `BASIC_AUTH_USER` - whatever username you want
   - `BASIC_AUTH_PASSWORD_HASH` - the hash from step 2
4. Deploy. Render runs `npm run build` (builds the client, then the server),
   then `npm run start` (applies any pending Prisma migrations, then starts
   the server). The first deploy will have an empty database - run the seed
   script once against production, e.g. from your machine:
   ```bash
   DATABASE_URL="<your Neon connection string>" npx tsx server/prisma/seed.ts
   ```
5. Visit the `.onrender.com` URL Render gives you. Your browser will prompt
   for the username/password you set in step 2/3.

Every subsequent `git push` to this branch (once connected) triggers a new
Render deploy automatically.

## Deployment (Vercel + Neon)

On Vercel the app splits into two pieces instead of one Node service: the
built client is served as static files from Vercel's CDN, and the Express API
(`server/src/app.ts`) runs as a serverless function at `/api/*`
(`api/[...path].ts`). A root `middleware.ts` runs Basic Auth in front of
*every* request - including the static assets, which the API's own Basic Auth
middleware can no longer gate once they're split out to the CDN.

### 1. Create the database (Neon)

Same as the Render setup above. Use the **pooled** connection string (the one
with `-pooler` in the hostname, or `?pgbouncer=true` appended) rather than the
direct one - serverless functions can spin up many concurrent instances, and
without pooling you can exhaust Postgres's connection limit quickly.

### 2. Generate your login credentials

Same as [step 2](#2-generate-your-login-credentials) above:
`npm run hash-password -- "your-password-here"` from `server/`.

### 3. Deploy (Vercel)

1. Push this repo to GitHub.
2. In the Vercel dashboard: **Add New → Project**, import this repo. Vercel
   will detect the root `vercel.json` (build command, output directory,
   rewrites) and the `api/` and `middleware.ts` functions automatically - no
   framework preset needed.
3. In **Project Settings → Environment Variables**, add:
   - `DATABASE_URL` - the pooled Neon connection string from step 1
   - `BASIC_AUTH_USER` - whatever username you want
   - `BASIC_AUTH_PASSWORD_HASH` - the hash from step 2
4. Deploy. The build runs `prisma migrate deploy` against `DATABASE_URL`
   before building the client, so every deploy (including preview
   deployments, if `DATABASE_URL` is shared across environments) applies any
   pending migrations. The first deploy will have an empty database - run the
   seed script once against production, e.g. from your machine:
   ```bash
   DATABASE_URL="<your Neon connection string>" npx tsx server/prisma/seed.ts
   ```
5. Visit the `.vercel.app` URL Vercel gives you. Your browser will prompt for
   the username/password you set above.

Every subsequent `git push` to this branch (once connected) triggers a new
Vercel deploy automatically.

## Project layout

```
server/
  prisma/schema.prisma   data model (Account, Group, Category, CategoryRule,
                         Transaction, Transfer, ImportBatch)
  prisma/seed.ts         default categories + starter rules
  src/routes/            REST endpoints per resource
  src/services/          rules engine, CSV import/normalization, summary aggregation
client/
  src/pages/             Dashboard, Accounts, AccountDetail, Transactions,
                         Categories, Transfers
  src/components/        shared UI (TransactionTable, ImportWizard, ui primitives)
  src/hooks/useApi.ts     TanStack Query hooks wrapping the API client
  src/lib/api.ts          typed API client
api/[...path].ts          Vercel-only: wraps the Express app as a serverless function
middleware.ts              Vercel-only: Basic Auth in front of every request
```
