import { createApp } from "../server/src/app";

// The single Vercel Serverless Function backing /api/*. Routed here via the
// legacy `routes`/`dest` mechanism in vercel.json (not `rewrites`), which is
// what actually preserves the original request path (e.g.
// "/api/summary/balances") as `req.url` - the newer dynamic-filename
// (`api/[...path].ts`) and `rewrites` mechanisms do not reliably do this for
// non-Next.js projects. An Express app is itself a valid (req, res) request
// handler, so it can be exported directly - no adapter needed.
export default createApp();
