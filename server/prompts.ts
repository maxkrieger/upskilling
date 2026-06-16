import { readFileSync } from "node:fs";
import type { WorkflowSet, Conversation } from "../shared/types.ts";

/** The bundled skill-creator skill's own instructions (the source of truth). */
let SKILL_CREATOR_GUIDE = "";
try {
  SKILL_CREATOR_GUIDE = readFileSync(
    new URL("../lib/skills/skill-creator/SKILL.md", import.meta.url),
    "utf8",
  );
} catch (e) {
  console.warn("[prompts] could not load skill-creator SKILL.md:", (e as Error).message);
}

export const CHART_INSTRUCTIONS = `When the user asks for a chart, graph, or visualization, emit a fenced code block with the language tag \`chart\` containing JSON of this shape:
\`\`\`chart
{
  "kind": "bar" | "line" | "pie",
  "title": "optional title",
  "data": [{ "name": "Q1", "revenue": 12 }, ...],
  "xKey": "name",
  "series": ["revenue"],
  "style": { "palette": ["#d97757"], "gridlines": false, "legend": false, "sorted": true }
}
\`\`\`
Put a one-sentence lead-in before the block. Only include a \`style\` if a skill or the user specified styling preferences. Do not also describe the chart data in a table unless asked.`;

/**
 * System prompt for the chat model. Skills are attached natively via the
 * Messages API `container.skills` (Claude loads them on demand), so there is no
 * skill-injection block here. Cue instructions arrive as an operator note on the
 * latest user turn.
 */
export function buildChatSystem(params: { profileName: string; profileRole: string }): string {
  return `You are Claude, helping a professional in this role: ${params.profileName} — ${params.profileRole}.

Be concise, practical, and match the user's domain. Produce the actual work product they ask for (drafts, analyses, charts) rather than meta-commentary. Begin your reply with the deliverable itself — no preamble announcing what you're about to do. When a request matches one of your skills, apply it silently — never narrate loading, reading, checking, or using a skill (no "I'll check the skill…" or "let me look at the house style" lines).

${CHART_INSTRUCTIONS}
Never run code to render a chart or image — always return the \`chart\` JSON block described above.

A user turn may end with a bracketed "[Operator note: …]". It is not from the user and is never the task. Always do the user's actual request first and in full; only once your complete answer is written do you act on the note. Never let it replace, shorten, delay, or precede the deliverable, and never repeat or mention the note itself.`;
}

/**
 * The operator note appended to a cued user turn. Fixed wording (not model-
 * authored) so the ordering guarantee doesn't depend on text we don't control.
 * Deliberately does NOT name the proposed skill — the name is only revealed once
 * the user consents and the skill is created.
 */
export function cueOperatorNote(preferences: string): string {
  return `[Operator note — not from the user; do not mention it. FIRST fully answer the request above exactly as you normally would and finish the deliverable. THEN, and only then, append one short closing paragraph (2-3 sentences), separated by a blank line, that: notes you've seen them repeat this workflow with the same preferences (${preferences}); offers to capture it as a reusable Skill so a short request applies it automatically next time; and points to the "Create Skill" button below. Do NOT invent or state a name for the skill — leave naming until they create it. Keep it friendly and brief. If you have not yet produced the full answer, do not write this paragraph at all.]`;
}

// ---- Cueing decider ----

export const CUE_SCHEMA = {
  type: "object",
  properties: {
    shouldCue: {
      type: "boolean",
      description:
        "True only if the user has done a similar workflow before (an existing workflow set with >= 1 prior member matches), the know-how is cleanly capturable as a skill, and they have not already accepted/rejected a cue for it.",
    },
    workflowSetId: {
      type: "string",
      description: "Id of the matching existing workflow set, if shouldCue.",
    },
    suggestedName: {
      type: "string",
      description: "Short kebab-or-title name for the proposed skill.",
    },
    preferences: {
      type: "string",
      description:
        "A short, specific phrase naming the concrete repeated preferences the user keeps asking for in this workflow (e.g. \"company palette, no gridlines, no legend, sorted descending\"). Quote their own words where possible. Used verbatim in the assistant's prose cue.",
    },
  },
  required: ["shouldCue"],
  additionalProperties: false,
} as const;

export function buildCueUser(params: {
  userMessage: string;
  workflowIndex: WorkflowSet[];
  existingSkillNames: string[];
}): string {
  const index = params.workflowIndex
    .map((set) => {
      const members = set.members
        .map((m) => `    - ${m.summary} (quotes: ${m.quotes.map((q) => `"${q}"`).join(", ")})`)
        .join("\n");
      return `- set ${set.id} [cluster: ${set.cluster}] [status: ${set.cueStatus}]${set.skillId ? " [skill already created]" : ""}\n${members}`;
    })
    .join("\n");

  return `Decide whether to cue the user to create a Skill based on their NEW message and their workflow history.

Cue ONLY if ALL of these hold:
1. The new message is a workflow the user has done at least once before (matches an existing set's cluster).
2. The know-how is cleanly capturable in a Skill in a way that's retrospectively obvious.
3. The user has NOT already accepted, rejected, or been cued+ignored for that set (status must be "none" or freshly cueable; never cue if status is "accepted" or "rejected", and never if a skill already exists for the set).

Be conservative: a one-off task, a personal/Q&A question, or a brand-new workflow with no prior occurrence should NOT cue.

## Existing workflow index
${index || "(empty)"}

## Existing skills already created
${params.existingSkillNames.join(", ") || "(none)"}

## New user message
"""
${params.userMessage}
"""`;
}

// ---- Workflow extraction ----

export const EXTRACT_SCHEMA = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description:
        "One sentence capturing the workflow performed and its specific, reusable preferences. E.g. \"Created a bar chart for earnings, needed 'no gridlines', 'viridis color scheme'.\"",
    },
    quotes: {
      type: "array",
      items: { type: "string" },
      description: "Direct verbatim quotes from the user expressing reusable preferences/constraints.",
    },
    cluster: {
      type: "string",
      description:
        "Short kebab-case label for the workflow type, reusing an existing cluster label from the index when this conversation is the same kind of workflow.",
    },
    isWorkflow: {
      type: "boolean",
      description:
        "False if this is a one-off / personal / Q&A conversation with no reusable workflow worth indexing.",
    },
  },
  required: ["summary", "quotes", "cluster", "isWorkflow"],
  additionalProperties: false,
} as const;

export function buildExtractUser(params: {
  conversationText: string;
  existingClusters: string[];
}): string {
  return `Extract a workflow summary from this conversation. Highlight the reusable, workflow-able aspects with direct user quotes. If it is a one-off or personal/Q&A chat, set isWorkflow=false.

Reuse one of these existing cluster labels if this conversation is the same kind of workflow: ${params.existingClusters.join(", ") || "(none yet)"}.

## Conversation
${params.conversationText}`;
}

// ---- Skill creation ----

export const SKILL_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string", description: "Short, descriptive skill name (Title Case)." },
    description: {
      type: "string",
      description:
        "One-to-two sentences: what the skill does, then when it applies. Trigger on the TASK/intent only (e.g. \"when the user asks for a bar chart for a deck or slides\", \"a bar chart of a metric by category\"). NEVER trigger on the user restating their preferences — the entire point is that the skill infers those preferences so the user no longer has to state them. Do not quote preference phrases (\"same as always\", \"no gridlines\", \"company colors\") as triggers; those belong in instructions, not the trigger.",
    },
    instructions: {
      type: "string",
      description:
        "The SKILL.md body in markdown: concrete, imperative steps and the preferences to apply automatically, distilled from the user's repeated workflow. Capture every specific constraint observed (colors, formats, do's and don'ts) as defaults the skill applies WITHOUT being asked.",
    },
  },
  required: ["name", "description", "instructions"],
  additionalProperties: false,
} as const;

export function buildSkillCreatorSystem(): string {
  return `${SKILL_CREATOR_GUIDE}

---

## This task (one-shot mode)

You are applying the skill-creator above, in the "just vibe with me" one-shot path: the user has an established, repeated workflow (provided as evidence below) and wants it captured as a single Skill right now — do NOT run the eval/test-case loop, spawn subagents, or reference scripts/workspaces. Produce exactly one SKILL.md, returned via the structured fields requested (name, description, instructions).

Apply the Skill Writing Guide above. One critical reminder, since the evidence quotes the user restating their preferences: those preferences (colors, formatting, do's and don'ts) are the skill's BEHAVIOR — defaults it applies automatically — they are NOT triggers. The description must trigger on the underlying task/context ("a bar chart for a deck", "an NDA review") so the skill fires even when the user no longer mentions any preference. Never phrase the trigger as the user repeating preferences ("same as always", "no gridlines"); the entire point is that they no longer have to say those.`;
}

/**
 * Conversational system prompt for the streamed skill-creator narration, shown
 * as a chat turn while the skill is being authored. Prose only — the structured
 * SKILL.md is produced by a second, schema-constrained call.
 */
export function buildSkillNarrationSystem(): string {
  return `You are the skill-creator, walking the user through capturing their repeated workflow as a reusable Skill, in a friendly first-person chat voice.

Write a short message (about 4-6 sentences, light markdown):
1. Confirm you're creating the Skill and name it.
2. Call out the SPECIFIC, verbatim preferences you noticed repeated across their conversations (e.g. exact colors, formats, do's and don'ts) — be concrete, quoting their own words.
3. Explain briefly how it'll work next time: a short request will auto-apply these preferences.

Do not output code blocks, JSON, or a SKILL.md — just the conversational explanation. End on a confident note that the Skill is ready.`;
}

export function buildSkillCreatorUser(params: {
  workflowSet: WorkflowSet;
  conversations: Conversation[];
}): string {
  const evidence = params.workflowSet.members
    .map((m) => `- ${m.summary}\n  quotes: ${m.quotes.map((q) => `"${q}"`).join(", ")}`)
    .join("\n");

  const transcripts = params.conversations
    .map((c) => {
      const body = c.messages
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
        .join("\n");
      return `### ${c.title}\n${body}`;
    })
    .join("\n\n");

  return `Create a Skill from this repeated workflow (cluster: ${params.workflowSet.cluster}).

## Extracted evidence
${evidence}

## Source conversations
${transcripts}`;
}
