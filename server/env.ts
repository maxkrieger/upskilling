import { config } from "dotenv";

config();

export const ENV = {
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",
  WEBSITE_DEMO_PASSWORD: process.env.WEBSITE_DEMO_PASSWORD ?? "",
  // Key for signing the auth cookie (HMAC). Falls back to the demo password so a
  // separate secret is optional, but set a distinct random value in prod.
  SESSION_SECRET: process.env.SESSION_SECRET ?? "",
  // Capable model for user-facing chat.
  MODEL_MAIN: process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8",
  // Model for background jobs (cueing decider, extraction). Sonnet — haiku was
  // too inconsistent on the cueing classification to rely on.
  MODEL_BACKGROUND: process.env.ANTHROPIC_MODEL_BACKGROUND ?? "claude-sonnet-4-6",
  API_PORT: Number(process.env.API_PORT ?? 8787),
  // Runtime error alerting.
  DISCORD_WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL ?? "",
  // Alerts fire in production by default, or anywhere with DISCORD_ALERTS=true.
  // Set DISCORD_ALERTS=false to silence even in production.
  DISCORD_ALERTS:
    process.env.DISCORD_ALERTS === "true" ||
    (process.env.DISCORD_ALERTS !== "false" && process.env.NODE_ENV === "production"),
  ENVIRONMENT: process.env.NODE_ENV ?? "development",
};

if (!ENV.ANTHROPIC_API_KEY) {
  console.warn(
    "[env] ANTHROPIC_API_KEY is not set — inference endpoints will fail.",
  );
}
