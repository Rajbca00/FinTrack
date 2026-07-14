import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { timingSafeEqual } from "crypto";

function safeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export type BasicAuthResult =
  | { ok: true }
  | { ok: false; status: number; body: string; wwwAuthenticate?: boolean };

// Verifies an `Authorization` header against BASIC_AUTH_USER /
// BASIC_AUTH_PASSWORD_HASH. Framework-agnostic so it can be shared between
// the Express app (below) and the Vercel root middleware.ts, which gates the
// static frontend once it's split out to Vercel's CDN and no longer passes
// through this Express app at all.
export function verifyBasicAuth(authorizationHeader: string | null | undefined): BasicAuthResult {
  const expectedUser = process.env.BASIC_AUTH_USER;
  const expectedHash = process.env.BASIC_AUTH_PASSWORD_HASH;

  if (!expectedUser || !expectedHash) {
    if (process.env.NODE_ENV === "production") {
      return {
        ok: false,
        status: 500,
        body: "Server misconfigured: BASIC_AUTH_USER / BASIC_AUTH_PASSWORD_HASH are not set",
      };
    }
    return { ok: true };
  }

  if (!authorizationHeader?.startsWith("Basic ")) {
    return { ok: false, status: 401, body: "Authentication required", wwwAuthenticate: true };
  }

  const decoded = Buffer.from(authorizationHeader.slice("Basic ".length), "base64").toString("utf8");
  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex === -1) {
    return { ok: false, status: 401, body: "Authentication required", wwwAuthenticate: true };
  }

  const suppliedUser = decoded.slice(0, separatorIndex);
  const suppliedPassword = decoded.slice(separatorIndex + 1);

  if (!safeEquals(suppliedUser, expectedUser) || !bcrypt.compareSync(suppliedPassword, expectedHash)) {
    return { ok: false, status: 401, body: "Authentication required", wwwAuthenticate: true };
  }

  return { ok: true };
}

// Gates the whole Express app (API + statically-served client on Render)
// behind a single shared username/password, since this holds real financial
// data and is reachable at a public URL with no per-user accounts. In
// production, missing credentials fail closed rather than silently serving
// the app unprotected.
export function basicAuth(req: Request, res: Response, next: NextFunction) {
  const result = verifyBasicAuth(req.headers.authorization);
  if (result.ok) return next();

  if (result.wwwAuthenticate) {
    res.set("WWW-Authenticate", 'Basic realm="FinTrack", charset="UTF-8"');
  }
  return res.status(result.status).send(result.body);
}
