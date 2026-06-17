// Cloudflare Pages Functions entry for the API. Routes /api/* through the same
// Hono app used in local dev (server/index.ts). Static SPA assets (dist/) are
// served by Pages directly; this only handles the API.
import { handle } from "hono/cloudflare-pages";
import app from "../../server/index.ts";

const handler = handle(app);

export const onRequest = (context: any) => {
  // Surface the Pages project's vars/secrets to the process.env-based ENV
  // accessors (server/env.ts reads them via getters at request time).
  const proc: any = (globalThis as any).process ?? ((globalThis as any).process = { env: {} });
  proc.env = proc.env ?? {};
  for (const [k, v] of Object.entries(context.env ?? {})) {
    if (typeof v === "string") proc.env[k] = v;
  }
  return handler(context);
};
