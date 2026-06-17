import { toFile } from "@anthropic-ai/sdk";
import { anthropic } from "./anthropic.ts";
import type { Skill } from "../shared/types.ts";

const beta = anthropic.beta as any;

/** Betas + tool required to attach Skills to a Messages API request. */
export const SKILLS_BETAS = ["code-execution-2025-08-25", "skills-2025-10-02"];
export const CODE_EXECUTION_TOOL = { type: "code_execution_20250825", name: "code_execution" };

function slugify(name: string): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "skill";
  // Suffix keeps names unique across users/recreations in the shared org.
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Register a SKILL.md with the official Skills API. */
export async function registerSkill(params: {
  name: string;
  description: string;
  instructions: string;
}): Promise<{ skillId: string; skillVersion: string }> {
  const slug = slugify(params.name);
  const skillMd = `---\nname: ${slug}\ndescription: ${params.description.replace(/\n/g, " ")}\n---\n\n${params.instructions}\n`;
  const created = await beta.skills.create({
    files: [await toFile(Buffer.from(skillMd), `${slug}/SKILL.md`)],
  });
  return { skillId: created.id, skillVersion: String(created.latest_version ?? "1") };
}

/** Register a NEW VERSION of an existing skill (in-place update). */
export async function registerSkillVersion(
  skillId: string,
  params: { name: string; description: string; instructions: string },
): Promise<{ skillVersion: string }> {
  // The SKILL.md `name` (and directory) must be IDENTICAL across all versions of
  // a skill, so reuse the existing skill's slug rather than minting a new one.
  let slug = slugify(params.name);
  try {
    const existing = await beta.skills.retrieve(skillId);
    if (existing?.display_title) slug = existing.display_title;
  } catch {
    /* fall back to a fresh slug */
  }
  const skillMd = `---\nname: ${slug}\ndescription: ${params.description.replace(/\n/g, " ")}\n---\n\n${params.instructions}\n`;
  const created = await beta.skills.versions.create(skillId, {
    files: [await toFile(Buffer.from(skillMd), `${slug}/SKILL.md`)],
  });
  return { skillVersion: String(created.version ?? created.latest_version ?? "1") };
}

/** Best-effort delete of a registered skill (all versions first, then the skill). */
export async function deleteSkillRemote(skillId: string): Promise<void> {
  try {
    for await (const v of beta.skills.versions.list(skillId)) {
      try {
        await beta.skills.versions.delete(v.version, { skill_id: skillId });
      } catch {
        /* ignore */
      }
    }
    await beta.skills.delete(skillId);
  } catch {
    /* best-effort */
  }
}

/**
 * Build the `container.skills` array from the user's enabled, registered skills
 * (max 8 per the API). Returns null when there are none, so the caller can do a
 * plain (container-free) completion.
 */
export function skillContainer(skills: Skill[]): { skills: Array<Record<string, string>> } | null {
  const refs = skills
    .filter((s) => s.enabled && s.skillId)
    .slice(0, 8)
    .map((s) => ({ type: "custom", skill_id: s.skillId!, version: s.skillVersion ?? "latest" }));
  return refs.length ? { skills: refs } : null;
}
