import { jsonCall } from "./anthropic.ts";
import { buildCueUser, CUE_SCHEMA } from "./prompts.ts";
import type { CueDecision, Skill, WorkflowSet } from "../shared/types.ts";

/**
 * The Skill cueing decider. Analyzes the latest user message against the user's
 * workflow index BEFORE the response model runs, deciding whether to nudge the
 * user to create a Skill. Returns a decision; when shouldCue, the caller builds
 * a fixed operator note from `preferences` and surfaces a static CTA banner.
 */
export async function decideCue(params: {
  userMessage: string;
  workflowIndex: WorkflowSet[];
  skills: Skill[];
}): Promise<CueDecision> {
  // Cheap pre-filter: nothing to cue against.
  const cueable = params.workflowIndex.filter(
    (s) => s.cueStatus !== "accepted" && s.cueStatus !== "rejected" && !s.skillId,
  );
  if (cueable.length === 0) return { shouldCue: false };

  const decision = await jsonCall<CueDecision>({
    system:
      "You are a precise classifier deciding whether to suggest creating a reusable Skill. Favor precision over recall: only cue when there is clear prior repetition of the same workflow.",
    user: buildCueUser({
      userMessage: params.userMessage,
      workflowIndex: cueable,
      existingSkillNames: params.skills.map((s) => s.name),
    }),
    schema: CUE_SCHEMA as unknown as Record<string, unknown>,
  });

  // Guard: the referenced set must actually be cueable.
  if (decision.shouldCue && decision.workflowSetId) {
    const ok = cueable.some((s) => s.id === decision.workflowSetId);
    if (!ok) return { shouldCue: false };
  }
  return decision;
}
