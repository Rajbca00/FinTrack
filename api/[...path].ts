import { createApp } from "../server/src/app";

// Catch-all Vercel Serverless Function for everything under /api/*. An
// Express app is itself a valid (req, res) request handler, so it can be
// exported directly - no adapter needed.
export default createApp();
