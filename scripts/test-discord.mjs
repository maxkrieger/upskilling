// Sends a single forced test alert to verify the Discord webhook wiring.
// Usage: node scripts/test-discord.mjs
import { reportError } from "../server/discord.ts";
import { ENV } from "../server/env.ts";

if (!ENV.DISCORD_WEBHOOK_URL) {
  console.error("DISCORD_WEBHOOK_URL is not set in .env");
  process.exit(1);
}

await reportError(
  new Error("Test alert: Discord error reporting is wired up correctly."),
  { source: "scripts/test-discord.mjs", details: { note: "manual wiring test" } },
  { force: true },
);
console.log("Sent test alert to Discord webhook.");
