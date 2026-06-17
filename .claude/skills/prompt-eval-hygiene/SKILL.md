---
name: prompt-eval-hygiene
description: Keep eval-distribution concepts OUT of model-facing prompts. Use this whenever editing server/prompts.ts or any string the model sees at runtime — system prompts, tool descriptions, JSON-schema field descriptions, operator/cue notes, few-shot examples. Embedding the specific personas, workflows, preferences, or example phrasings that the evals test ("eval hacking") biases the model toward exactly those cases and inflates scores without real generalization. Consult this before writing any example or instruction into a prompt.
---

# Prompt eval hygiene (no eval hacking)

The cueing decider, skill-creator, extractor, and chat system prompt are scored by evals built from the demo personas. If a prompt names the personas' concepts, the model "recognizes" the test set instead of generalizing — the score goes up but the product doesn't get better. That's eval hacking, and it's prohibited in model-facing prompts.

## The rule

**Model-facing prompts must be distribution-neutral.** Describe the *logic* (what makes something a repeated workflow, a distinct instance vs. a refinement, a standing preference vs. ordinary use, a task-based trigger vs. a restated preference) in the abstract. Do not hardcode the specific subjects, preferences, or example phrasings the evals exercise.

This applies to everything the model reads at runtime:
- `buildChatSystem`, `cueOperatorNote`, `updateOperatorNote`
- `buildCueUser` / `CUE_SCHEMA` (the decider)
- `buildExtractUser` / `EXTRACT_SCHEMA`
- `buildSkillCreatorSystem` / `SKILL_SCHEMA` and tool descriptions in `server/skills.ts`

## What counts as in-distribution (do NOT put these in prompts)

The demo/eval personas and their signature details — e.g.:
- charts: bar/line charts, gridlines on/off, legend on/off, sorting, a specific palette/hex (e.g. a clay-orange brand color), "for a deck / board / QBR"
- contract review: NDAs, "mutual", "CA/DE governing law", "non-solicit", "off-market clauses", "flags + required edits", clause-by-clause tables
- social captions: Instagram captions, hashtags, "em dashes", "highbrow / sophisticated voice", "LLM slop / grandiosity"

…and any close paraphrase. If an example you're about to type matches what an eval checks for, it doesn't belong in the prompt.

## How to write it instead

- Use abstract nouns: "the workflow", "a recurring kind of request", "the preferences/constraints the user keeps restating", "a different document/dataset/asset", "the in-progress output".
- If you need an illustrative example, pick something clearly OUTSIDE the eval personas (and even then, prefer abstraction).
- Schema field descriptions: describe the field's role, not a canned value to copy.

## Where the line is

- **Allowed** to reference personas: the eval DATA and fixtures — `src/data/profiles/*`, `scripts/eval-cases.ts`, eval target/concept lists in `scripts/eval.ts`. That's the test set; it's *supposed* to be in-distribution.
- **Not allowed**: anything assembled into a request to the model (the files listed above).

## Checklist before saving a prompt change

1. Grep your diff for persona terms (nda, gridline, palette, legend, caption, hashtag, em dash, deck, non-solicit, sorted, highbrow, the brand hex, etc.). Any hit in a model-facing string is a red flag.
2. Every example is either abstract or clearly out-of-distribution.
3. The instruction would work identically for a workflow the evals never test.
4. Product-format references (e.g. an output block this app actually renders) are fine, but use neutral placeholder values, not the personas' exact preferences.
