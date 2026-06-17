import { readFileSync } from "node:fs";
import { toFile } from "@anthropic-ai/sdk";
import { anthropic } from "./anthropic.ts";
import type { Skill } from "../shared/types.ts";

const beta = anthropic.beta as any;

/** Betas + tool required to attach Skills to a Messages API request:
 * code execution (required for Skills), the Skills API, and the Files API
 * (uploading/downloading files to/from the container). */
export const SKILLS_BETAS = [
  "code-execution-2025-08-25",
  "skills-2025-10-02",
  "files-api-2025-04-14",
];
export const CODE_EXECUTION_TOOL = { type: "code_execution_20250825", name: "code_execution" };

/** Client tools the chat model calls to persist skills (the ONLY way to save). */
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
        description: "What it does + WHEN it should trigger (task/context based, not the user restating preferences).",
      },
      instructions: {
        type: "string",
        description: "The SKILL.md body: imperative steps and the preferences to apply automatically.",
      },
      highlights: {
        type: "array",
        items: { type: "string" },
        description:
          "2-4 very short bullets (a few words each) of what the skill does/applies — shown to the user as a capability checklist. E.g. \"Apply company palette\", \"Remove gridlines + legend\", \"Sort bars descending\".",
      },
    },
    required: ["name", "description", "instructions", "highlights"],
  },
};

/** Update an existing skill (matched by name) by folding in a new preference. */
export const UPDATE_SKILL_TOOL = {
  name: "update_skill",
  description:
    "Update an existing Skill the user already has by folding in a new standing preference. BEFORE calling this, you MUST consult the skill-creator skill — read its SKILL.md (mounted in the container) and follow its methodology for revising a skill. Then call this tool with the SAME name as that skill and the full revised description + instructions. This is the only way the update is persisted.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "The existing skill's name (unchanged)." },
      description: { type: "string", description: "Revised description (still task-based trigger)." },
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
      const md = readFileSync(new URL("../lib/skills/skill-creator/SKILL.md", import.meta.url), "utf8");
      const { name, description, body } = parseSkillMd(md);
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
