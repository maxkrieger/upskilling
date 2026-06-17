// Local Node dev entry: serves the runtime-agnostic Hono app (server/index.ts)
// over HTTP. In production the same app runs on Cloudflare Pages Functions
// (functions/api/[[route]].ts), which has no Node server.
import { serve } from "@hono/node-server";
import app from "./index.ts";
import { ENV } from "./env.ts";
import { reportError } from "./discord.ts";

process.on("unhandledRejection", (reason) => {
  console.error("[api] unhandledRejection:", reason);
  void reportError(reason, { source: "process.unhandledRejection" });
});
process.on("uncaughtException", (err) => {
  console.error("[api] uncaughtException:", err);
  void reportError(err, { source: "process.uncaughtException" });
});

const server = serve({ fetch: app.fetch, port: ENV.API_PORT }, (info) => {
  console.log(`[api] listening on http://localhost:${info.port} (model: ${ENV.MODEL_MAIN})`);
});

// Exit promptly on reload/quit so `tsx watch` doesn't hit its 5s force-kill (the
// listening socket + the SDK's keep-alive sockets otherwise hold the loop open).
let closing = false;
for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.once(sig, () => {
    if (closing) process.exit(0);
    closing = true;
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 250).unref();
  });
}
