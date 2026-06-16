import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The SPA is served by Vite in dev; API calls are proxied to the local Hono
// server (server/index.ts) running on :8787. In production these would be
// Cloudflare Pages Functions under the same origin.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
});
