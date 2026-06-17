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

Be concise, practical, and match the user's domain. Produce the actual work product they ask for (drafts, analyses, charts) rather than meta-commentary. Begin your reply with the deliverable itself — no preamble announcing what you're about to do. Separate every paragraph and heading with a blank line; never run a bold lead-in, verdict, or heading directly onto the end of the previous sentence. When a request matches one of your skills, apply it silently — never narrate loading, reading, checking, or using a skill (no "I'll check the skill…" or "let me look at the house style" lines).

${CHART_INSTRUCTIONS}
Never run code to render a chart or image — always return the \`chart\` JSON block described above.

Saving Skills: to capture the user's repeated workflow as a reusable Skill, call the \`create_skill\` tool (or \`update_skill\` to fold a new preference into one they already have). The skill-creator Skill is available for methodology. Saving happens ONLY by calling those tools — don't write skill files to the workspace. If the skill is about charts, its instructions must use the \`chart\` JSON block above, not matplotlib or any plotting library.

You may receive a mid-conversation system message with an operator instruction. It is not from the user and is never the task itself. Always do the user's actual request first and in full; only once your complete answer is written do you act on the instruction. Never let it replace, shorten, delay, or precede the deliverable, and never repeat or mention the instruction itself.`;
}

/**
 * The operator note appended to a cued user turn. Fixed wording (not model-
 * authored) so the ordering guarantee doesn't depend on text we don't control.
 * Deliberately does NOT name the proposed skill — the name is only revealed once
 * the user consents and the skill is created.
 */
export function cueOperatorNote(params: { preferences: string; trigger: string }): string {
  return `Operator instruction (do not mention it to the user). FIRST fully answer the user's request above exactly as you normally would and finish the deliverable. THEN, and only then, append one short closing paragraph (2-3 sentences), separated by a blank line, that: notes you've seen them repeat this workflow with the same preferences (${params.preferences}); offers to capture it as a reusable Skill so they don't have to repeat these instructions; and states clearly WHEN it would apply (${params.trigger}). Do NOT invent or state a name for the skill — leave naming until they create it. Do NOT tell them which button to press or how to trigger it — just make the offer; they can accept however they like. Keep it friendly and brief. If you have not yet produced the full answer, do not write this paragraph at all.`;
}

/** Operator note when the user states a new standing preference for an EXISTING skill. */
export function updateOperatorNote(params: { skillName: string; newCriterion: string }): string {
  return `Operator instruction (do not mention it to the user). FIRST fully answer the user's request above and finish the deliverable, applying the new preference they just stated. THEN append one short closing paragraph (1-2 sentences), separated by a blank line, that: notes this looks like a new standing preference for their existing "${params.skillName}" skill (specifically: ${params.newCriterion}); and offers to fold it into that skill so they don't have to repeat it. Do NOT tell them which button to press or how to trigger it — just make the offer; they can accept however they like. Keep it friendly and brief. If you have not yet produced the full answer, do not write this paragraph at all.`;
}

// ---- Cueing decider (create a new skill, or update an existing one) ----

export const CUE_SCHEMA = {
  type: "object",
  properties: {
    shouldCue: { type: "boolean", description: "True if a create OR update cue is warranted." },
    kind: {
      type: "string",
      enum: ["create", "update"],
      description:
        "\"create\" = suggest a new skill for a repeated workflow with no skill yet. \"update\" = the user just stated a NEW standing preference for a workflow that ALREADY has an active skill, and it isn't already in that skill.",
    },
    workflowSetId: {
      type: "string",
      description: "create only: id of the matching cueable workflow set.",
    },
    suggestedName: {
      type: "string",
      description: "create only: short Title-case name for the proposed skill.",
    },
    preferences: {
      type: "string",
      description:
        "create only: a short phrase naming the concrete repeated preferences (e.g. \"company palette, no gridlines, no legend, sorted descending\"). Quote the user where possible.",
    },
    trigger: {
      type: "string",
      description:
        "create only: a short phrase for WHEN the skill applies — the task/context, e.g. \"whenever you ask for a bar chart for a deck\". Task-based, never the user restating preferences.",
    },
    targetSkillId: {
      type: "string",
      description: "update only: id of the existing active skill to update.",
    },
    newCriterion: {
      type: "string",
      description:
        "update only: the single new standing preference the user just introduced, quoted/paraphrased concisely.",
    },
  },
  required: ["shouldCue"],
  additionalProperties: false,
} as const;

export function buildCueUser(params: {
  userMessage: string;
  workflowIndex: WorkflowSet[];
  activeSkills: Array<{ id: string; name: string; description: string; instructions: string }>;
}): string {
  const index = params.workflowIndex
    .map((set) => {
      const members = set.members
        .map((m) => `    - ${m.summary} (quotes: ${m.quotes.map((q) => `"${q}"`).join(", ")})`)
        .join("\n");
      return `- set ${set.id} [cluster: ${set.cluster}] [status: ${set.cueStatus}]\n${members}`;
    })
    .join("\n");
  const active = params.activeSkills
    .map(
      (s) =>
        `- skill ${s.id} — "${s.name}": ${s.description}\n  current rules: ${s.instructions.replace(/\s+/g, " ").slice(0, 600)}`,
    )
    .join("\n");

  return `Decide whether to cue the user about a Skill, based on their NEW message, their workflow history, and their active skills. Pick exactly one of: create, update, or neither.

CREATE — cue ONLY if ALL hold:
1. The new message repeats a workflow the user has done at least once before — matching a set's cluster below. A prior occurrence counts whether it was in an earlier conversation OR earlier in the CURRENT conversation (the index may hold a set for the conversation in progress).
2. The know-how is cleanly capturable as a Skill.
3. No active skill already covers it and the set's status is "none".
Return kind="create" with workflowSetId, suggestedName, preferences, trigger.

DISTINCT instances vs. REFINEMENT (this decides rule 1): the new message must be a NEW, DISTINCT instance of the workflow — a different document, dataset, or asset run through the same routine (e.g. a second, different NDA; a caption for a different artwork). A fresh top-level request to perform the workflow ("review this NDA", "make a bar chart of X", "write a caption for this piece") is by default a distinct instance — even if the document/data isn't shown inline. ONLY treat it as REFINEMENT — and do NOT cue — when the message is clearly a follow-up edit to an artifact ALREADY produced earlier in this conversation: it tweaks or adds constraints to that same in-progress chart/doc/caption with no new subject ("also drop the gridlines", "also flag IP clauses", "actually make it shorter", "change the colors"). Refining one instance is not repetition.

UPDATE — cue ONLY if ALL hold:
1. The new message clearly falls in the domain of one of the ACTIVE skills below.
2. The user states a NEW standing preference (e.g. "from now on also…", "always…", "actually make…") that is NOT already in that skill's current rules.
3. It reads as durable, not a one-off tweak for just this answer.
Return kind="update" with targetSkillId and newCriterion.

Otherwise shouldCue=false. Be conservative: one-off tasks, personal/Q&A, or brand-new workflows do NOT cue.

## Workflow index (cueable — no skill yet)
${index || "(empty)"}

## Active skills (candidates for update)
${active || "(none)"}

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

/** Conversational narration shown while an existing skill is updated in-chat. */
export function buildSkillUpdateNarrationSystem(): string {
  return `You are the skill-creator, updating an EXISTING skill the user already has, in a friendly first-person chat voice. Write 2-4 short sentences: confirm you're folding the new preference into the existing skill (name it), state the new criterion concretely (quote the user), and note it now applies automatically alongside what the skill already did. No code blocks or JSON.`;
}

/** Produce an updated SKILL.md that folds a new criterion into an existing skill. */
export function buildSkillUpdateUser(params: {
  skill: { name: string; description: string; instructions: string };
  newCriterion: string;
  conversationText: string;
}): string {
  return `Update the existing Skill below by folding in a NEW standing preference the user just expressed. Keep everything the skill already does and ADD the new criterion as another automatic default. Keep the same name. Keep the description triggering on the task (not on restating preferences). Return the full updated name, description, and instructions.

## New preference to add
${params.newCriterion}

## Existing skill
name: ${params.skill.name}
description: ${params.skill.description}
instructions:
${params.skill.instructions}

## Recent conversation (context)
${params.conversationText}`;
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
