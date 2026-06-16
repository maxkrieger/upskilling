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
  index.ts             Routes: /api/auth, /api/chat (SSE), /api/extract, /api/skills/create
  cue.ts               Skill cueing decider (runs before the response model)
  prompts.ts           System prompts + JSON schemas (chat, cue, extract, create)
  anthropic.ts         Streaming + forced-JSON tool-call helpers
src/                   React SPA (Vite + Tailwind + zustand + Recharts)
  store.ts             localStorage-persisted state; per-turn workflow extraction
  data/profiles/*      Seeded personae + pre-extracted workflow indices
  components/          Chat, Sidebar, Composer, charts, cue banner, Customize
scripts/
  extract-profiles.ts  Offline workflow-extraction pipeline (npm run extract:offline)
  eval.ts              Cueing precision/recall/F1 + skill quality (npm run eval)
lib/skills/skill-creator  The bundled skill-creator Skill
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

## Models

- Chat: `claude-opus-4-8` (streaming)
- Cueing / extraction: `claude-haiku-4-5` (fast classification)

Override via `ANTHROPIC_MODEL` / `ANTHROPIC_MODEL_FAST` in `.env`.

## Notes / scope

- State (conversations, skills, workflow index) lives in `localStorage`; the
  backend is stateless, matching the Cloudflare Pages target.
- The API runs locally via `@hono/node-server`; the same Hono app can be mounted
  as Cloudflare Pages Functions for deployment.
