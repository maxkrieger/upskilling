import { toFile } from "@anthropic-ai/sdk";
import { anthropic } from "./anthropic.ts";
import { SKILL_CREATOR_MD } from "./generated/skillCreator.ts";
import type { Skill } from "../shared/types.ts";

// Lazy `beta` accessor: resolves the real client on each access (at REQUEST
// time), never at module load. A bare `const beta = anthropic.beta` would fire
// the client proxy during import — before the per-request env bridge populates
// process.env on Workers — building (and memoizing) a keyless client, so every
// API call would then fail with "Could not resolve authentication method".
const beta: any = new Proxy({}, { get: (_t, p) => (anthropic.beta as any)[p] });

/** Betas + tool required to attach Skills to a Messages API request:
 * code execution (required for Skills), the Skills API, and the Files API
 * (uploading/downloading files to/from the container). */
export const SKILLS_BETAS = [
  "code-execution-2025-08-25",
  "skills-2025-10-02",
  "files-api-2025-04-14",
];
export const CODE_EXECUTION_TOOL = { type: "code_execution_20250825", name: "code_execution" };

// The create_skill / update_skill tool definitions live in server/prompts.ts —
// all model-facing prompt strings (incl. tool descriptions) are centralized
// there. index.ts attaches them to the chat request alongside CODE_EXECUTION_TOOL.

function parseSkillMd(md: string): { name: string; description: string; body: string } {
  const m = md.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  const fm = m?.[1] ?? "";
  return {
    name: fm.match(/name:\s*(.*)/)?.[1]?.trim() ?? "skill-creator",
    description: fm.match(/description:\s*(.*)/)?.[1]?.trim() ?? "",
    body: (m?.[2] ?? md).trim(),
  };
}

// Register the skill-creator with the Skills API once per process and reuse the
// id, so its (modified, tool-oriented) guidance is mounted into the chat
// container. Memoized; on failure we retry on the next call.
let skillCreatorRef: Promise<{ skill_id: string; version: string; slug: string }> | null = null;
export function getSkillCreatorRef(): Promise<{ skill_id: string; version: string; slug: string }> {
  if (!skillCreatorRef) {
    skillCreatorRef = (async () => {
      const { name, description, body } = parseSkillMd(SKILL_CREATOR_MD);
      const reg = await registerSkill({ name, description, instructions: body });
      return { skill_id: reg.skillId, version: reg.skillVersion, slug: reg.slug };
    })().catch((e) => {
      skillCreatorRef = null; // allow retry
      throw e;
    });
  }
  return skillCreatorRef;
}

/** Extract a skill's directory slug from a registered SKILL.md path string. */
export function firedSlugFrom(text: string): string | null {
  return text.match(/\/skills\/([^/"\\]+)\//)?.[1] ?? null;
}

/** Normalize a slug to its name-base (drops the random uniqueness suffix). */
export function slugBase(slug: string): string {
  return slug.replace(/-[a-z0-9]{2,8}$/, "");
}

/** The name-base a skill would slugify to (for matching firings to skills). */
export function nameSlugBase(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "skill"
  );
}

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
}): Promise<{ skillId: string; skillVersion: string; slug: string }> {
  const slug = slugify(params.name);
  const skillMd = `---\nname: ${slug}\ndescription: ${params.description.replace(/\n/g, " ")}\n---\n\n${params.instructions}\n`;
  const created = await beta.skills.create({
    files: [await toFile(Buffer.from(skillMd), `${slug}/SKILL.md`)],
  });
  return { skillId: created.id, skillVersion: String(created.latest_version ?? "1"), slug };
}

/** Register a NEW VERSION of an existing skill (in-place update). */
export async function registerSkillVersion(
  skillId: string,
  params: { name: string; description: string; instructions: string },
): Promise<{ skillVersion: string; slug: string }> {
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
  return { skillVersion: String(created.version ?? created.latest_version ?? "1"), slug };
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
 * Build the `container.skills` array: the skill-creator (so its guidance is
 * available for authoring) plus the user's enabled, registered skills (cap 8
 * total per the API).
 */
export function skillContainer(
  skills: Skill[],
  creatorRef?: { skill_id: string; version: string },
): { skills: Array<Record<string, string>> } {
  const refs: Array<Record<string, string>> = [];
  if (creatorRef) {
    refs.push({ type: "custom", skill_id: creatorRef.skill_id, version: creatorRef.version });
  }
  for (const s of skills.filter((s) => s.enabled && s.skillId).slice(0, 7)) {
    refs.push({ type: "custom", skill_id: s.skillId!, version: s.skillVersion ?? "latest" });
  }
  return { skills: refs };
}
