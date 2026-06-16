import type { Skill, WorkflowSet, Conversation } from "../shared/types.ts";

/** Format the active skills block injected into the chat system prompt. */
function skillsBlock(skills: Skill[]): string {
  const active = skills.filter((s) => s.enabled);
  if (active.length === 0) return "No custom skills are currently active.";
  return active
    .map(
      (s) =>
        `### Skill: ${s.name}\n${s.description}\n\nInstructions:\n${s.instructions}`,
    )
    .join("\n\n");
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
 * System prompt for the user-facing chat model. `cueInstruction` is injected by
 * the cueing decider when a skill should be suggested at the end of the reply.
 */
export function buildChatSystem(params: {
  profileName: string;
  profileRole: string;
  skills: Skill[];
  cueInstruction?: string;
}): string {
  return `You are Claude, helping a professional in this role: ${params.profileName} — ${params.profileRole}.

Be concise, practical, and match the user's domain. Produce the actual work product they ask for (drafts, analyses, charts) rather than meta-commentary.

${CHART_INSTRUCTIONS}

## Active skills
The user has these custom skills enabled. When a request matches a skill, silently apply its instructions to your output — do not announce that you are using a skill.

${skillsBlock(params.skills)}

${
    params.cueInstruction
      ? `## After answering: suggest a skill
FIRST, fully and normally complete the user's actual request — produce the real work product (the chart, draft, analysis, etc.) exactly as you would without this note. Do not mention skills until that work is done.

THEN, only after your complete answer, add a short closing paragraph (2-3 sentences, visually separated) that naturally suggests capturing this as a Skill. The suggestion must read as a friendly afterthought that follows your work, never as the opening of your reply, and must never replace, shorten, or interrupt the deliverable.

Specific guidance for this turn: ${params.cueInstruction}`
      : ""
  }`.trim();
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
    rationale: {
      type: "string",
      description:
        "One or two sentences, self-justifying and specific, naming the concrete repeated preferences. Shown to the user in a banner.",
    },
    modelInstruction: {
      type: "string",
      description:
        "A directive telling the assistant how to voice this cue in a short closing paragraph AFTER it has already fully completed the user's request. It should name the specific repeated preferences the assistant noticed and how a Skill would simplify future invocation. Must be phrased so the suggestion comes last and never precedes or replaces the actual work product.",
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
        "One-to-two sentence description starting with what it does, including trigger phrasing so it activates on the right requests. This is what the model sees to decide relevance.",
    },
    instructions: {
      type: "string",
      description:
        "The SKILL.md body in markdown: concrete, imperative steps and preferences distilled from the user's repeated workflow. Capture every specific constraint observed (colors, formats, do's and don'ts).",
    },
  },
  required: ["name", "description", "instructions"],
  additionalProperties: false,
} as const;

export function buildSkillCreatorSystem(): string {
  return `You are the skill-creator. You turn a user's repeated workflow into a reusable Skill (a SKILL.md). Capture the concrete, specific preferences the user expressed verbatim across their conversations so that a single short request in future reproduces their exact desired output. Be precise and imperative. Do not invent preferences the evidence does not support.`;
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
