// Shared domain types used by the frontend SPA, the Hono backend, and the
// offline data/eval scripts. Keep this dependency-free so it imports cleanly
// everywhere.

export type Role = "user" | "assistant";

export type AttachmentKind = "csv" | "image" | "text" | "pdf";

export interface Attachment {
  id: string;
  name: string;
  kind: AttachmentKind;
  /** For text/csv: raw text. For image: data URL or path under /data. */
  content: string;
}

export type ChartKind = "bar" | "line" | "pie";

/** A chart the assistant chose to render inline. */
export interface ChartSpec {
  kind: ChartKind;
  title?: string;
  /** Row objects, e.g. [{ name: "Q1", value: 12 }]. */
  data: Array<Record<string, string | number>>;
  /** Key in each row used for the category axis. */
  xKey: string;
  /** One or more numeric series keys. */
  series: string[];
  /** Styling, often derived from an applied Skill. */
  style?: ChartStyle;
}

export interface ChartStyle {
  palette?: string[];
  gridlines?: boolean;
  legend?: boolean;
  /** For bar charts: sort descending by first series. */
  sorted?: boolean;
}

/** Inline call-to-action attached to an assistant message cueing skill creation. */
export interface SkillCueBanner {
  /** The workflow set id this cue is about. */
  /** "create" a new skill, or "update" an existing one with a new criterion. */
  kind: "create" | "update";
  /** create: the workflow set this cue is about. */
  workflowSetId?: string;
  /** update: the existing (local) skill id to update. */
  targetSkillId?: string;
  suggestedName: string;
  /** Dynamic summary: the repeated preferences (create) or new criterion (update). */
  summary?: string;
  /** create only: when the skill applies (the trigger condition). */
  trigger?: string;
  status: "pending" | "accepted" | "dismissed" | "snoozed";
  /** Set once accepted: the local id of the skill that was created/updated, so
   * the banner can render its name/description/highlights. */
  createdSkillId?: string;
}

export interface Message {
  id: string;
  role: Role;
  content: string; // markdown
  attachments?: Attachment[];
  chart?: ChartSpec;
  banner?: SkillCueBanner;
  /** For an accepted result-card banner: the content offset at which the skill
   * tool fired, so the card is spliced inline there (between the pre- and
   * post-tool text) rather than rendered above the whole reply. */
  cardSplitAt?: number;
  /** Which skill ids were applied to produce this message, if any. */
  appliedSkillIds?: string[];
  createdAt: string; // ISO
}

export interface Conversation {
  id: string;
  profileId: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
  /** True for conversations created by the live user (vs. seeded demo data). */
  userCreated?: boolean;
}

export interface PresetPrompt {
  id: string;
  title: string;
  subtitle?: string;
  prompt: string;
  attachmentRefs?: string[]; // names resolved against profile.attachments
  /** A non-workflow, one-off Q&A — it should NOT cue or fire a skill. Marks the
   * spurious examples for evals (and the demo). Defaults to false (a repeatable
   * workflow that should cue/fire). */
  oneOff?: boolean;
}

// ---- Workflow extraction / index ----

/** One conversation's workflow-relevant summary with verbatim quotes. */
export interface WorkflowSummary {
  conversationId: string;
  /** "Created a bar chart for earnings, needed 'no gridlines', 'viridis'." */
  summary: string;
  quotes: string[];
  /** Short label of the workflow cluster, e.g. "deck-bar-charts". */
  cluster: string;
}

/**
 * A set of related conversation summaries. Once a set has >= 2 members a Skill
 * is "overdue" and we cue the user. Chronological list of these sets makes the
 * workflow index.
 */
export interface WorkflowSet {
  id: string;
  cluster: string;
  members: WorkflowSummary[];
  /** Whether the user has been cued and how they responded. */
  cueStatus: "none" | "cued" | "accepted" | "rejected";
  /** Set when a skill has been created from this set. */
  skillId?: string;
  updatedAt: string;
}

// ---- Skills ----

export interface Skill {
  id: string;
  name: string;
  description: string;
  /** SKILL.md body / instructions. */
  instructions: string;
  source: "builtin" | "user";
  /** Originating workflow set, if created from a cue. */
  fromWorkflowSetId?: string;
  enabled: boolean;
  createdAt: string;
  /** Official Skills API id + version, once registered (user skills only). */
  skillId?: string;
  skillVersion?: string;
  /** Registered SKILL.md directory slug — used to detect when this skill fires
   * (the model reads `/skills/<slug>/SKILL.md`). */
  slug?: string;
  /** Times this skill has actually fired (loaded) in a response. */
  fireCount?: number;
  /** A few short capability bullets (what the skill does), shown on the created
   * banner and authored by the model when it calls create_skill/update_skill. */
  highlights?: string[];
}

// ---- Profiles (seeded demo personae) ----

export interface Profile {
  id: string;
  name: string; // "Data Analyst"
  role: string; // one-line role description
  blurb: string;
  emoji: string;
  presets: PresetPrompt[];
  /** Shown instead of `presets` once the user has an active skill in this
   * profile — a different, looser set of starters that lean on the skill(s). */
  loosePresets?: PresetPrompt[];
  attachments: Attachment[]; // shared assets referenced by presets/conversations
  conversations: Conversation[];
  workflowIndex: WorkflowSet[];
  /** Skills that ship pre-made for this persona (besides skill-creator). */
  seededSkills?: Skill[];
}

// ---- API payloads ----

export interface ChatRequest {
  profileId: string;
  profileName: string;
  profileRole: string;
  /** Full prior message history for the conversation (Messages API is stateless). */
  messages: Array<Pick<Message, "role" | "content" | "attachments">>;
  /** Currently enabled skills (builtin + user); user skills carry skillId. */
  skills: Skill[];
  /** The user's current workflow index for cueing. */
  workflowIndex: WorkflowSet[];
  /** When true, skip cue detection entirely (the user snoozed cues). */
  suppressCue?: boolean;
}

/** Sent as the first SSE `meta` event before text streaming begins. */
export interface ChatMeta {
  banner?: SkillCueBanner;
  appliedSkillIds: string[];
  /** Dev-only trace id for this turn (see server/trace.ts; logged client-side). */
  traceId?: string;
}

export interface ExtractRequest {
  conversation: Pick<Conversation, "id" | "messages">;
  /** Existing index so the extractor can cluster into an existing set. */
  existingIndex: WorkflowSet[];
}

export interface ExtractResponse {
  summary: WorkflowSummary;
}

export interface CueDecision {
  shouldCue: boolean;
  kind?: "create" | "update";
  workflowSetId?: string;
  /** update: id of the existing active skill to update. */
  targetSkillId?: string;
  suggestedName?: string;
  /** Concrete repeated preferences to name in the prose cue (create). */
  preferences?: string;
  /** When the skill applies (task/context that triggers it) (create). */
  trigger?: string;
  /** update: the single new standing preference the user introduced. */
  newCriterion?: string;
}
