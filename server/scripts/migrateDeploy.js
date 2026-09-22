const { spawnSync } = require("node:child_process");

// The `prisma` CLI auto-loads `.env` itself, but this wrapper reads
// `process.env.DATABASE_URL` directly (to derive the direct URL below)
// before the CLI ever starts, so it needs to load `.env` too.
require("dotenv").config();

// `prisma migrate deploy` serializes concurrent runs with a Postgres
// advisory lock, which isn't reliably supported over Neon's pooled
// (PgBouncer, transaction-mode) endpoint - the lock wait can time out with
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

// Neon's free-tier compute auto-suspends when idle and cold-starts on the
// next connection - which can take longer than Prisma's fixed 10s advisory
// lock timeout, so the very first attempt after a while can fail with the
// same P1002 purely because it's what woke the compute up. Retrying right
// after (the compute is warm by then) resolves that without masking a real
// failure for long: a genuine problem (bad credentials, broken migration)
// fails identically on every attempt and still surfaces after these.
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 8000;

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

let result;
for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
  if (attempt > 1) console.log(`Retrying prisma migrate deploy (attempt ${attempt}/${MAX_ATTEMPTS})...`);
  result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: directUrl },
    shell: process.platform === "win32",
  });
  if (result.status === 0) break;
  if (attempt < MAX_ATTEMPTS) sleepSync(RETRY_DELAY_MS);
}
process.exit(result.status ?? 1);
