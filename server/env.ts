import { config } from "dotenv";

// Load .env for local Node dev. Skipped on the Workers runtime (no filesystem);
// there, values come from the Pages project's vars/secrets via process.env
// (nodejs_compat). Guarded so a missing .env never throws.
try {
  if (typeof navigator === "undefined" || navigator.userAgent !== "Cloudflare-Workers") {
    config();
  }
} catch {
  /* no .env file (serverless) — rely on real environment vars */
}

const e = (k: string, d = ""): string =>
  (typeof process !== "undefined" ? process.env?.[k] : undefined) ?? d;

/**
 * Environment access via getters so values are read at REQUEST time, not module
 * load. On the Workers runtime `process.env` is populated per request, so a
 * module-load snapshot would be empty.
 */
export const ENV = {
  get ANTHROPIC_API_KEY() {
    return e("ANTHROPIC_API_KEY");
  },
  get WEBSITE_DEMO_PASSWORD() {
    return e("WEBSITE_DEMO_PASSWORD");
  },
  // Key for signing the auth cookie (HMAC); falls back to the demo password.
  get SESSION_SECRET() {
    return e("SESSION_SECRET");
  },
  // Capable model for user-facing chat.
  get MODEL_MAIN() {
    return e("ANTHROPIC_MODEL", "claude-opus-4-8");
  },
  // Model for background jobs (cueing decider, extraction).
  get MODEL_BACKGROUND() {
    return e("ANTHROPIC_MODEL_BACKGROUND", "claude-sonnet-4-6");
  },
  get API_PORT() {
    return Number(e("API_PORT", "8787"));
  },
  get DISCORD_WEBHOOK_URL() {
    return e("DISCORD_WEBHOOK_URL");
  },
  // Alerts fire in production by default, or anywhere with DISCORD_ALERTS=true.
  get DISCORD_ALERTS() {
    return e("DISCORD_ALERTS") === "true" || (e("DISCORD_ALERTS") !== "false" && e("NODE_ENV") === "production");
  },
  get ENVIRONMENT() {
    return e("NODE_ENV", "development");
  },
};
