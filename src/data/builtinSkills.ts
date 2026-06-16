import type { Skill } from "../../shared/types.ts";
// Embed the real skill-creator SKILL.md at build time (source of truth), so the
// builtin skill shown in Customize matches the actual skill the create flow uses.
import skillCreatorMd from "../../lib/skills/skill-creator/SKILL.md?raw";

/** Split YAML frontmatter (name/description) from the markdown body. */
function parseSkillMd(md: string): { description: string; body: string } {
  const m = md.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  const frontmatter = m?.[1] ?? "";
  const body = (m?.[2] ?? md).trim();
  const description = frontmatter.match(/description:\s*(.*)/)?.[1]?.trim() ?? "";
  return { description, body };
}

const parsed = parseSkillMd(skillCreatorMd);

/**
 * The skill-creator skill ships with every profile and is what the "create
 * skill" flow invokes (see server /api/skills/create). It is never removable.
 * Its description + instructions are the real SKILL.md, embedded verbatim.
 */
export const SKILL_CREATOR: Skill = {
  id: "skill_creator_builtin",
  name: "skill-creator",
  description: parsed.description,
  instructions: parsed.body,
  source: "builtin",
  enabled: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

export const BUILTIN_SKILLS: Skill[] = [SKILL_CREATOR];
