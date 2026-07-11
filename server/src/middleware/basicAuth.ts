import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { timingSafeEqual } from "crypto";

function safeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

// Gates the entire app (API + static client) behind a single shared
// username/password, since this holds real financial data and is reachable
// at a public URL with no per-user accounts. In production, missing
// credentials fail closed rather than silently serving the app unprotected.
export function basicAuth(req: Request, res: Response, next: NextFunction) {
  const expectedUser = process.env.BASIC_AUTH_USER;
  const expectedHash = process.env.BASIC_AUTH_PASSWORD_HASH;

  if (!expectedUser || !expectedHash) {
    if (process.env.NODE_ENV === "production") {
      return res.status(500).send("Server misconfigured: BASIC_AUTH_USER / BASIC_AUTH_PASSWORD_HASH are not set");
    }
    return next();
  }

  const header = req.headers.authorization;
  const reject = () => {
    res.set("WWW-Authenticate", 'Basic realm="FinTrack", charset="UTF-8"');
    return res.status(401).send("Authentication required");
  };

  if (!header?.startsWith("Basic ")) return reject();

  const decoded = Buffer.from(header.slice("Basic ".length), "base64").toString("utf8");
  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex === -1) return reject();

  const suppliedUser = decoded.slice(0, separatorIndex);
  const suppliedPassword = decoded.slice(separatorIndex + 1);

  if (!safeEquals(suppliedUser, expectedUser) || !bcrypt.compareSync(suppliedPassword, expectedHash)) {
    return reject();
  }

  next();
}
