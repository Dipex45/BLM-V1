/**
 * Vercel entry point. Vercel serves the built pages from dist/ and sends every /api/* request
 * here (see the rewrite in vercel.json), so the same API that runs on Railway runs on Vercel.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { createApp } from "../server.js";

let appPromise: ReturnType<typeof createApp> | null = null;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    appPromise ??= createApp({ serveFrontend: false });
    const app = await appPromise;
    app(req as Parameters<typeof app>[0], res as Parameters<typeof app>[1]);
  } catch (error) {
    // Usually a missing setting such as FIREBASE_SERVICE_ACCOUNT_JSON. Try again on the next request.
    appPromise = null;
    console.error("API failed to start:", error instanceof Error ? error.message : error);
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Online booking is temporarily unavailable. Please try again shortly, or book with us on WhatsApp." }));
  }
}
