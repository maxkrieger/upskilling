# Upskilling — making Claude Skills discoverable in context

A proof-of-concept that extends a Claude.ai-style chat product so that **Skills
surface themselves at the user's point of need**. When you repeat a workflow the
app has seen before, it offers — inline, with a one-click banner — to capture
that workflow as a reusable Skill.

See [`CLAUDE.md`](./CLAUDE.md) for the full product brief.

## Quick start

```bash
cp .env.example .env      # fill in WEBSITE_DEMO_PASSWORD and ANTHROPIC_API_KEY
npm install
npm run dev               # starts the API (:8787) and the Vite SPA (:5173)
```

Open http://localhost:5173 and enter the demo password from `.env`.

## How the demo works

1. Pick a **profile** from the sidebar dropdown — `Data Analyst`, `Corporate
   Counsel` (lawyer), or `Social Media Manager`. Each comes pre-loaded with a
   realistic chat history: a couple of clusters of repeated workflow
   conversations, plus spurious personal/Q&A chats.
2. Start a **new chat** and use one of the **preset starters** above the
   composer (or type freely). The presets are chosen to mirror each persona's
   repeated workflow.
3. Because the persona has done that workflow before, the assistant answers
   normally **and** ends with a short, self-justifying nudge plus an inline
   **"Create Skill"** banner.
4. Click **Create Skill**. The app invokes the skill-creator flow, distills the
   repeated preferences into a `SKILL.md`, and saves it to `localStorage`. The
   skill is now active and applied to future requests.
5. Visit **Customize · Skills** in the sidebar to toggle, inspect, delete, or
   hand-author skills.

Try a one-off/personal question (e.g. "what's a p-value?") to confirm it does
**not** trigger a cue.

## Architecture

```
shared/types.ts        Domain model shared by frontend, backend, and scripts
server/                Hono API (local: @hono/node-server; portable to CF Pages)
  index.ts             Routes: /api/auth, /api/chat (SSE), /api/extract,
                       /api/skills/{create,register,delete}
  skills.ts            Skills API: register/delete + container.skills builder
  cue.ts               Skill cueing decider (runs before the response)
  prompts.ts           System prompts + JSON schemas (chat, cue, extract, create)
  anthropic.ts         Streaming (plain + beta skills) + forced-JSON helpers
src/                   React SPA (Vite + Tailwind + zustand + Recharts)
  store.ts             localStorage-persisted state; per-turn workflow extraction
  data/profiles/*      Seeded personae + pre-extracted workflow indices
  components/          Chat, Sidebar, Composer, charts, cue banner, Customize
  components/ui/       shadcn-style primitives (Radix Select)
scripts/
  extract-profiles.ts  Offline workflow-extraction pipeline (npm run extract:offline)
  eval.ts              Cueing precision/recall/F1 + skill quality (npm run eval)
lib/skills/skill-creator  The bundled skill-creator Skill
```

### Skills on the Messages API (stateless backend)

Created skills are registered with the official **Skills API**, then attached to
a normal streamed **Messages API** call via the `container.skills` parameter (+
the `code-execution` tool and the `code-execution-2025-08-25,skills-2025-10-02`
betas). Claude loads each skill natively (progressive disclosure) — no
system-prompt injection. This keeps the backend fully stateless and preserves
native token streaming (no Managed Agents sessions/agents/containers to manage).

- **Skill ids** live in the browser's `localStorage` (on each Skill), matching
  the per-browser model. Toggling a skill just changes which ids are sent.
- **`/api/chat`** is one `messages.stream()` per turn: full history (client
  holds it) + `container.skills` for the user's enabled, registered skills (max
  8; omitted entirely when there are none, for a plain fast completion).
- The cueing decider and per-turn extraction are plain Messages-API calls. The
  cue is delivered as a fixed operator note appended to the latest user turn;
  the banner is held back and shown only after the reply finishes streaming.

### Skill cueing

Before the response model sees a new user message, `decideCue` classifies it
against the user's workflow index. It cues **only** when:

- the user has done a similar workflow at least once before (matching cluster),
- the know-how is cleanly capturable as a Skill, and
- the user hasn't already accepted/rejected a cue for that workflow.

On a positive decision, the chat system prompt gets an instruction to voice the
cue at the end of the reply, and a structured banner is streamed to the UI as
the first SSE `meta` event.

### Workflow extraction

Each conversation is distilled into a one-sentence summary with verbatim user
quotes, clustered with related conversations into a `WorkflowSet`. A set with ≥2
members is "overdue" for a Skill. For live user chats this is re-extracted every
turn; for the seeded personae it's pre-extracted (regenerate with
`npm run extract:offline`).

## Evaluation

```bash
npm run eval
```

Reports precision/recall/F1 for the cueing decider over a labeled dataset
(`scripts/eval-cases.ts`: matched-overdue positives vs. spurious / already-handled
/ first-occurrence negatives) and key-preference coverage for generated skills.
Results are written to `eval-results/`.

## Error alerting (Discord)

Runtime errors route to a Discord webhook in deployment. Set `DISCORD_WEBHOOK_URL`
in the environment; alerts fire when `NODE_ENV=production` (or force with
`DISCORD_ALERTS=true`, silence with `DISCORD_ALERTS=false`).

Covered paths:

- **Backend** — `app.onError` (any uncaught route error), the chat stream and
  cue-decider catches, and Node `uncaughtException`/`unhandledRejection`.
  Implemented with global `fetch`, so it also works in Cloudflare Pages Functions.
- **Frontend** — `window.error` / `unhandledrejection` listeners and a React
  `ErrorBoundary` POST to `/api/report-error`, which forwards to Discord.

Alerts are deduped (60s per fingerprint) and never block or break a request.
Verify the wiring with `node scripts/test-discord.mjs` (sends one test alert).

## Models

- Chat: `claude-opus-4-8` (streaming)
- Cueing / extraction: `claude-haiku-4-5` (fast classification)

Override via `ANTHROPIC_MODEL` / `ANTHROPIC_MODEL_FAST` in `.env`.

## Notes / scope

- State (conversations, skills, workflow index) lives in `localStorage`; the
  backend is stateless, matching the Cloudflare Pages target.
- The API runs locally via `@hono/node-server`; the same Hono app can be mounted
  as Cloudflare Pages Functions for deployment.
