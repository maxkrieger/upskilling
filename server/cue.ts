import { jsonCall } from "./anthropic.ts";
import { buildCueUser, CUE_SCHEMA } from "./prompts.ts";
import type { CueDecision, Skill, WorkflowSet } from "../shared/types.ts";

/**
 * The Skill cueing decider. Before the response model runs, classify the latest
 * user message into: cue to CREATE a new skill (a repeated workflow with no
 * skill yet), cue to UPDATE an existing skill (a new standing preference for one
 * they already have), or no cue.
 */
export async function decideCue(params: {
  userMessage: string;
  workflowIndex: WorkflowSet[];
  skills: Skill[];
}): Promise<CueDecision> {
  // Create candidates: repeated workflows without a skill, not already handled.
  const cueable = params.workflowIndex.filter(
    (s) => s.cueStatus !== "accepted" && s.cueStatus !== "rejected" && !s.skillId,
  );
  // Update candidates: active, registered user skills.
  const activeSkills = params.skills
    .filter((s) => s.enabled && s.source !== "builtin" && s.skillId)
    .map((s) => ({ id: s.id, name: s.name, description: s.description, instructions: s.instructions }));

  if (cueable.length === 0 && activeSkills.length === 0) return { shouldCue: false };

  const decision = await jsonCall<CueDecision>({
    system:
      "You are a precise classifier for Skill suggestions. Favor precision over recall: only cue on clear prior repetition (create) or a clear new standing preference for an existing skill (update).",
    user: buildCueUser({ userMessage: params.userMessage, workflowIndex: cueable, activeSkills }),
    schema: CUE_SCHEMA as unknown as Record<string, unknown>,
  });

  if (!decision.shouldCue) return { shouldCue: false };

  const kind = decision.kind ?? (decision.targetSkillId ? "update" : "create");
  if (kind === "update") {
    if (!decision.targetSkillId || !activeSkills.some((s) => s.id === decision.targetSkillId)) {
      return { shouldCue: false };
    }
    return { ...decision, kind: "update" };
  }
  if (!decision.workflowSetId || !cueable.some((s) => s.id === decision.workflowSetId)) {
    return { shouldCue: false };
  }
  return { ...decision, kind: "create" };
}
