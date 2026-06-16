import { config } from "dotenv";

config();

export const ENV = {
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",
  WEBSITE_DEMO_PASSWORD: process.env.WEBSITE_DEMO_PASSWORD ?? "",
  // Capable model for user-facing chat.
  MODEL_MAIN: process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8",
  // Fast model for background classification (cueing, extraction).
  MODEL_FAST: process.env.ANTHROPIC_MODEL_FAST ?? "claude-haiku-4-5-20251001",
  API_PORT: Number(process.env.API_PORT ?? 8787),
};

if (!ENV.ANTHROPIC_API_KEY) {
  console.warn(
    "[env] ANTHROPIC_API_KEY is not set — inference endpoints will fail.",
  );
}
