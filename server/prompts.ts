import type { WorkflowSet, Conversation } from "../shared/types.ts";
// Embedded at codegen time (no node:fs — Workers has no filesystem). Source of
// truth is lib/skills/skill-creator/SKILL.md; run `npm run gen:skill` to refresh.
import { SKILL_CREATOR_MD } from "./generated/skillCreator.ts";

/** The bundled skill-creator skill's own instructions (the source of truth). */
const SKILL_CREATOR_GUIDE = SKILL_CREATOR_MD;

/** Generic tool used by jsonCall to force a structured (schema-shaped) reply. */
export const JSON_RESPONSE_TOOL = {
  name: "respond",
  description: "Return the structured response.",
} as const;

export const CHART_INSTRUCTIONS = `When the user asks for a chart, graph, or visualization, emit a fenced code block with the language tag \`chart\` containing JSON of this shape:
\`\`\`chart
{
  "kind": "bar" | "line" | "pie",
  "title": "optional title",
  "data": [{ "name": "A", "value": 12 }, ...],
  "xKey": "name",
  "series": ["value"],
  "style": { "palette": ["#888888"], "gridlines": true, "legend": true, "sorted": false }
}
\`\`\`
Put a one-sentence lead-in before the block. The \`style\` object is optional and its fields are independent (set only what a skill or the user specified; the values above are just placeholders, not defaults). Do not also describe the chart data in a table unless asked.`;

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

Saving Skills: to capture the user's repeated workflow as a reusable Skill, call the \`create_skill\` tool (or \`update_skill\` to fold a new preference into one they already have). The skill-creator Skill is available for methodology. Saving happens ONLY by calling those tools — don't write skill files to the workspace. A skill's instructions must produce output via this product's native formats (e.g. the structured blocks documented above), never via external code or third-party libraries.

Do NOT narrate your process — no "I'll consult the skill-creator methodology first" or "let me capture this" lines. After the tool call, the UI shows a card with the skill's name and capability highlights, so don't restate those. Write only a short confirmation: one line that it's ready, then 2-3 example phrasings (short, casual versions of how they'd ask for this kind of task) that would trigger it loosely in a future chat, as a bullet list. Keep it brief.

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

export const CUE_SYSTEM =
  "You are a precise classifier for Skill suggestions. Favor precision over recall: only cue on clear prior repetition (create) or a clear new standing preference for an existing skill (update).";

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
        "create only: a short phrase naming the concrete preferences/constraints the user keeps restating. Quote the user where possible.",
    },
    trigger: {
      type: "string",
      description:
        "create only: a short phrase for WHEN the skill applies — the recurring task/context it should trigger on. Task-based, never the user restating preferences.",
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

DISTINCT instances vs. REFINEMENT (this decides rule 1): the new message must be a NEW, DISTINCT instance of the workflow — a different document, dataset, or asset run through the same routine. A fresh top-level request to perform the workflow on new input is a distinct instance, even if the input isn't shown inline. Do NOT count it as repetition (and do NOT cue) when the message is merely a follow-up edit to the SAME item already produced earlier in this conversation — adding or tweaking a constraint on that in-progress output with no new subject ("also do X", "actually make it shorter", "change that"). Refining one instance is not repetition.

UPDATE — cue ONLY if ALL hold:
1. The new message clearly falls in the domain of one of the ACTIVE skills below.
2. The user EXPLICITLY states a NEW, STANDING preference — a durable rule change for that skill, phrased as such ("from now on…", "always…", "going forward also…", "I want X every time"). Simply USING the skill — running it on new input, asking for a quick/normal/usual version, or any one-off request — is NOT a preference change and must NOT cue an update.
3. The stated preference is not already in that skill's current rules, and is durable, not a one-off tweak for just this answer.
Return kind="update" with targetSkillId and newCriterion.

Otherwise shouldCue=false. Be conservative: one-off tasks, personal/Q&A, brand-new workflows, and ordinary use of an existing skill do NOT cue. When unsure between update and neither, choose neither.

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

export const EXTRACT_SYSTEM =
  "You extract reusable workflow descriptions from conversations, quoting the user's specific preferences verbatim.";

export const EXTRACT_SCHEMA = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description:
        "One sentence capturing the workflow performed and its specific, reusable preferences, quoting the user's constraints verbatim.",
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

Existing cluster labels: ${params.existingClusters.join(", ") || "(none yet)"}.
If this conversation is the same KIND of workflow as one of those, you MUST return that existing label VERBATIM (exact characters) — do not invent a near-synonym or change capitalization/punctuation. Only mint a new kebab-case label when it's a genuinely different workflow.

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
        "One-to-two sentences: what the skill does, then when it applies. Trigger on the TASK/intent only (the recurring kind of request, by its subject and context), broad enough to fire even when the user phrases the request minimally and omits every preference — just the ask plus its data — yet specific enough that unrelated requests don't match. Sanity-check it against a few varied future phrasings (including terse, preference-free ones) and a couple of unrelated asks before settling on the wording; never tailor it to specific example prompts. NEVER trigger on the user restating their preferences — the entire point is that the skill infers those preferences so the user no longer has to state them. Do not quote preference phrases (e.g. \"same as always\", \"the usual\") as triggers; those belong in instructions, not the trigger.",
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

// ---- Client tools the chat model calls to persist skills (the ONLY way to
//      save). Centralized here with the other model-facing prompt strings;
//      server/skills.ts attaches them to the chat request. ----
export const CREATE_SKILL_TOOL = {
  name: "create_skill",
  description:
    "Save a new Skill so the user's preferences apply automatically next time. BEFORE calling this, you MUST consult the skill-creator skill — read its SKILL.md (it is mounted in the container) and follow its authoring methodology to shape the name, description, and instructions. Then call this tool to persist the result. This is the only way a skill is saved — do not write files to the workspace and do not ask the user to copy/paste.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Short Title-case skill name." },
      description: {
        type: "string",
        description:
          "What it does + WHEN it should trigger. Trigger on the recurring TASK/intent (its subject and context), broad enough to fire even when the user phrases the request minimally and omits every preference — just the ask plus its data — yet specific enough that unrelated requests don't match. Before finalizing, mentally test a few varied future phrasings of this task (including terse, preference-free ones) to confirm they'd trigger, plus a couple of unrelated asks to confirm they wouldn't, and refine the wording for that balance. Never restate the user's preferences as the trigger, and never tailor it to specific example prompts.",
      },
      instructions: {
        type: "string",
        description: "The SKILL.md body: imperative steps and the preferences to apply automatically.",
      },
      highlights: {
        type: "array",
        items: { type: "string" },
        description:
          "2-4 very short bullets (a few words each) of the concrete defaults the skill applies automatically — shown to the user as a capability checklist.",
      },
    },
    required: ["name", "description", "instructions", "highlights"],
  },
};

export const UPDATE_SKILL_TOOL = {
  name: "update_skill",
  description:
    "Update an existing Skill the user already has by folding in a new standing preference. BEFORE calling this, you MUST consult the skill-creator skill — read its SKILL.md (mounted in the container) and follow its methodology for revising a skill. Then call this tool with the SAME name as that skill and the full revised description + instructions. This is the only way the update is persisted.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "The existing skill's name (unchanged)." },
      description: {
        type: "string",
        description:
          "Revised description — keep the task-based trigger broad enough to fire on terse, preference-free requests yet specific to this task; never tailor it to specific example prompts.",
      },
      instructions: { type: "string", description: "Full revised SKILL.md body, keeping prior behavior + the new preference." },
      highlights: {
        type: "array",
        items: { type: "string" },
        description: "2-4 very short capability bullets for the updated skill (a few words each), including the newly added behavior.",
      },
    },
    required: ["name", "description", "instructions", "highlights"],
  },
};

export function buildSkillCreatorSystem(): string {
  return `${SKILL_CREATOR_GUIDE}

---

## This task (one-shot mode)

You are applying the skill-creator above, in the "just vibe with me" one-shot path: the user has an established, repeated workflow (provided as evidence below) and wants it captured as a single Skill right now — do NOT run the eval/test-case loop, spawn subagents, or reference scripts/workspaces. Produce exactly one SKILL.md, returned via the structured fields requested (name, description, instructions).

Apply the Skill Writing Guide above. One critical reminder, since the evidence quotes the user restating their preferences: those preferences (formats, do's and don'ts, style choices) are the skill's BEHAVIOR — defaults it applies automatically — they are NOT triggers. The description must trigger on the underlying task/context (the recurring kind of request) so the skill fires even when the user no longer mentions any preference. Never phrase the trigger as the user repeating preferences (e.g. "same as always", "the usual"); the entire point is that they no longer have to say those.`;
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
