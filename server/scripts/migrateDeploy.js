const { spawnSync } = require("node:child_process");

// The `prisma` CLI auto-loads `.env` itself, but this wrapper reads
// `process.env.DATABASE_URL` directly (to derive the direct URL below)
// before the CLI ever starts, so it needs to load `.env` too.
require("dotenv").config();

// `prisma migrate deploy` serializes concurrent runs with a Postgres
// advisory lock, which isn't reliably supported over Neon's pooled
// (PgBouncer, transaction-mode) endpoint - the lock wait times out with
// P1002 ("reached but timed out") even though the DB itself is healthy.
// See https://pris.ly/d/migrate-advisory-locking.
//
// Neon's direct (unpooled) endpoint is the same host with "-pooler"
// removed from the compute id, so migrations run against that instead;
// the app itself keeps using the pooled DATABASE_URL at runtime. If
// DATABASE_URL isn't a Neon pooled URL, this is a no-op.
const pooled = process.env.DATABASE_URL;
if (!pooled) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const directUrl = pooled.replace(/^(postgres(?:ql)?:\/\/[^@]+@)([^.]+)-pooler(\.)/, "$1$2$3");

const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: directUrl },
  shell: process.platform === "win32",
});
process.exit(result.status ?? 1);
