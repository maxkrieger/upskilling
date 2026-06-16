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
  managedAgents.ts     Managed Agents + Skills API orchestration (stateless)
  cue.ts               Skill cueing decider (runs before the agent turn)
  prompts.ts           System prompts + JSON schemas (agent, cue, extract, create)
  anthropic.ts         Streaming + forced-JSON tool-call helpers
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

### Managed Agents + Skills (stateless backend)

Chat runs on the official **Managed Agents** API, and created skills are
registered with the official **Skills API** — so Claude loads each skill
natively (progressive disclosure), rather than us injecting SKILL.md text into a
system prompt. The Hono backend stays stateless across users/isolates by keeping
every durable id in the browser's `localStorage`:

| Resource | Lifetime | Where the id lives |
| --- | --- | --- |
| Environment | one shared container template | server, lazily ensured by name (idempotent) |
| Skill | per created skill | `localStorage` (`skillId` + version on the Skill) |
| Agent | per (browser, profile), keyed by a skill-set fingerprint | `localStorage` (`agents[profileId]`) |
| Session | per conversation (holds history server-side) | `localStorage` (on the Conversation) |

On each turn the client sends its cached agent handle + session id; the server
reuses them when the skill-set fingerprint still matches, otherwise creates a new
agent/session and returns the new ids in the SSE `meta` event for the client to
persist. Toggling/deleting a skill changes the fingerprint, so the next turn
rebuilds the agent. Because sessions hold history, the client sends only the new
user turn, not the full transcript.

The cueing decider and per-turn workflow extraction remain plain, stateless
Messages-API calls. Cue instructions are delivered as an operator note on the
user turn (the agent's system prompt is fixed at agent-create time).

**Cleanup.** Managed Agents resources accumulate server-side. Archive the demo's
agents and delete its sessions with:

```bash
npm run cleanup:agents            # sessions + agents (keeps skills + env)
npm run cleanup:agents -- --dry   # preview only
npm run cleanup:agents -- --all   # also delete skills + the shared environment
```

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
