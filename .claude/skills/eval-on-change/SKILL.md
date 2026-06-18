---
name: eval-on-change
description: Re-run the offline eval suite after ANY change to model-facing prompts, the cueing/extraction/skill pipeline, or the eval data. Use whenever you edit server/prompts.ts, server/cue.ts, server/skills.ts, server/anthropic.ts, shared/workflow.ts, lib/skills/skill-creator/SKILL.md, src/data/profiles/*, or scripts/eval*.ts. The suite (npm run eval) is the gate that catches cueing precision/recall regressions, skill-quality coverage drops, and trigger over/under-firing before you ship. Pairs with prompt-eval-hygiene (which keeps the prompts honest so these scores mean something).
---

# Re-run evals on prompt / pipeline changes

Behavior here is model-driven and easy to regress invisibly: a one-word change to a
prompt or a tool description can quietly break cueing precision, stop a created skill
from firing, or make it over-fire. The eval suite is the safety net. **If you touched
anything the model reads at runtime or the logic around it, run the evals before
calling the change done.**

## When this applies

Run `npm run eval` after editing any of:

- **Model-facing prompts** — `server/prompts.ts` (chat system, cue decider, extract,
  skill schema, operator/cue notes), tool descriptions in `server/skills.ts`,
  `lib/skills/skill-creator/SKILL.md` (regenerate first: `npm run gen:skill`).
- **Pipeline logic** — `server/cue.ts` (decider), `server/skills.ts` (registration,
  container, slug matching), `server/anthropic.ts` (streamChat / firing detection),
  `shared/workflow.ts` (index upsert/clustering).
- **Eval data** — `src/data/profiles/*` (seeded conversations, presets, workflow
  index) and `scripts/eval-cases.ts` (CUE_CASES, TRIGGER_PROBES).

## How to run

```bash
npm run eval                 # full suite (several minutes; sequential — the demo
                             # org rate-limits concurrency, so don't parallelize)
EVAL_REPEAT=3 npm run eval   # variance run: repeats the trigger probes ×3 to
                             # expose flaky firing (a probe that only fires 2/3)
```

Results print per-check and are written to `eval-results/eval.json`.

Also useful, and faster, for narrower changes:
- `npm run test:http` — SSE contract + a real create_skill round-trip.
- `npm run probe` — headless-browser e2e against the deployed app.

## What the suite covers (and the bars to hold)

- **Index upsert** (deterministic) — cluster-drift re-cue guard. Must be 100%.
- **Cueing decider** — precision / recall / F1 over `CUE_CASES`. Target **precision
  1.0** (never cue spurious/already-handled work); recall as high as possible.
- **Multi-doc in one conversation** — extract → cue on a second distinct doc, not on
  a refinement. Expect 3/3.
- **Skill quality** — semantic concept coverage of the generated skill per cluster.
  Target **1.00**.
- **Lifecycle + trigger coverage** — every workflow preset create-cues and creates a
  skill (creator fires first); then the created skill must fire on the varied terse
  positive probes and stay quiet on the negative probes. Coverage = robustness.

## Reading the results

- The cueing decider and the agentic create/fire steps are **live model calls**, so a
  borderline case can flip run-to-run. A single ✗ on a known-borderline check is
  usually nondeterminism — re-run, or use `EVAL_REPEAT=3` to see the rate — not
  necessarily your change. A **systematic** drop (a whole dimension regresses, or a
  probe goes from firing to never firing) IS your change. Investigate before shipping.
- A `precision` drop below 1.0 (a new false-positive cue) is the most important
  regression — treat it as blocking.

## Don't game it

Improving scores by hardcoding the eval's personas/phrasings into a model-facing
prompt is eval hacking — see **prompt-eval-hygiene**. Make the prompt generalize; let
the eval measure it. Adding/extending probes in `scripts/eval-cases.ts` (the test set)
is encouraged — broader probes = more robust coverage.
