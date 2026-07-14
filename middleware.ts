import { next } from "@vercel/functions";
import { verifyBasicAuth } from "./server/src/middleware/basicAuth";

// Runs on Vercel's Node.js runtime (not Edge) so it can reuse the exact
// bcryptjs/crypto logic from server/src/middleware/basicAuth.ts. On Vercel
// the static client build is served directly from the CDN and never passes
// through the Express app in api/, so this is what gates it - the Express
// app's own basicAuth middleware only covers /api/* on this platform, but
// runs here too as defense in depth (and is what actually gates everything
// on the Render deployment, where there's no separate static CDN).
export const config = {
  runtime: "nodejs",
};

export default function middleware(request: Request) {
  const result = verifyBasicAuth(request.headers.get("authorization"));
  if (result.ok) return next();

  const headers: Record<string, string> = {};
  if (result.wwwAuthenticate) {
    headers["WWW-Authenticate"] = 'Basic realm="FinTrack", charset="UTF-8"';
  }
  return new Response(result.body, { status: result.status, headers });
}
