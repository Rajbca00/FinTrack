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

- `server/`: Node.js, Express, TypeScript, Prisma (SQLite), zod.
- `client/`: React, TypeScript, Vite, Tailwind CSS v4, TanStack Query, Recharts.

## Getting started

### 1. Server

```bash
cd server
npm install
cp .env.example .env      # if you haven't already
npx prisma migrate dev    # creates server/prisma/dev.db and applies the schema
npx tsx prisma/seed.ts    # seeds default categories and auto-categorization rules
npm run dev               # starts the API on http://localhost:4000
```

### 2. Client

```bash
cd client
npm install
npm run dev               # starts the app on http://localhost:5173
```

The client dev server proxies `/api` requests to `http://localhost:4000`, so run
both at once.

### Database

SQLite is used for simplicity — the database is a single file at
`server/prisma/dev.db`. To reset it: delete that file, then re-run
`npx prisma migrate deploy` and `npx tsx prisma/seed.ts`.

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
```
