import type { Skill } from "../../shared/types.ts";

/**
 * The skill-creator skill ships with every profile and is what the "create
 * skill" flow invokes (see server /api/skills/create). It is never removable.
 */
export const SKILL_CREATOR: Skill = {
  id: "skill_creator_builtin",
  name: "skill-creator",
  description:
    "Create new skills, modify and improve existing skills, and measure skill performance. Use when users want to create a skill from scratch, edit, or optimize an existing skill, run evals to test a skill, or optimize a skill's description for better triggering accuracy.",
  instructions:
    "Turn a user's repeated workflow into a reusable Skill (a SKILL.md). Capture the concrete, specific preferences the user expressed verbatim across their conversations so a single short request reproduces their desired output. Draft, test with example prompts, evaluate, and iterate.",
  source: "builtin",
  enabled: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

export const BUILTIN_SKILLS: Skill[] = [SKILL_CREATOR];
