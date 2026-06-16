import { createHash } from "node:crypto";
import { toFile } from "@anthropic-ai/sdk";
import { anthropic } from "./anthropic.ts";
import { ENV } from "./env.ts";
import { buildAgentSystem, cueOperatorNote } from "./prompts.ts";
import type { AgentHandle, Attachment, Skill } from "../shared/types.ts";

// The beta namespaces are fully typed in the SDK but verbose; we use a loosely
// typed handle to keep this module readable.
const beta = anthropic.beta as any;

const ENV_NAME = "upskilling-demo";
let envIdCache: string | null = null;

/** Lazily ensure the one shared cloud environment exists (idempotent by name). */
export async function ensureEnvironment(): Promise<string> {
  if (envIdCache) return envIdCache;
  for await (const e of beta.environments.list({ limit: 100 })) {
    if (e.name === ENV_NAME) {
      envIdCache = e.id;
      return e.id;
    }
  }
  const env = await beta.environments.create({
    name: ENV_NAME,
    config: { type: "cloud", networking: { type: "unrestricted" } },
  });
  envIdCache = env.id;
  return env.id;
}

function slugify(name: string): string {
  const base = name
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

/** Best-effort delete of a registered skill (all versions first, then the skill). */
export async function deleteSkillRemote(skillId: string): Promise<void> {
  try {
    for await (const v of beta.skills.versions.list(skillId)) {
      try {
        await beta.skills.versions.delete(skillId, v.version);
      } catch {
        /* ignore */
      }
    }
    await beta.skills.delete(skillId);
  } catch {
    /* best-effort */
  }
}

function skillRefs(skills: Skill[]) {
  return skills
    .filter((s) => s.enabled && s.skillId)
    .map((s) => ({ type: "custom" as const, skill_id: s.skillId!, version: s.skillVersion ?? null }));
}

/** A stable fingerprint of the inputs an agent is built from. */
function fingerprint(system: string, refs: ReturnType<typeof skillRefs>): string {
  const refKey = refs
    .map((r) => `${r.skill_id}@${r.version ?? "latest"}`)
    .sort()
    .join(",");
  return createHash("sha1").update(system).update("|").update(refKey).digest("hex").slice(0, 16);
}

/**
 * Ensure an agent matching the current (profile + skill set) exists. Reuses the
 * client-cached agent when its fingerprint still matches; otherwise creates a
 * new one and returns the new handle for the client to persist.
 */
export async function ensureAgent(params: {
  profileName: string;
  profileRole: string;
  skills: Skill[];
  clientAgent?: AgentHandle;
}): Promise<AgentHandle> {
  const system = buildAgentSystem({ profileName: params.profileName, profileRole: params.profileRole });
  const refs = skillRefs(params.skills);
  const fp = fingerprint(system, refs);

  if (params.clientAgent?.id && params.clientAgent.fingerprint === fp) {
    return params.clientAgent;
  }

  const agent = await beta.agents.create({
    name: `Upskilling — ${params.profileName}`,
    model: ENV.MODEL_MAIN,
    system,
    tools: [{ type: "agent_toolset_20260401" }],
    skills: refs,
  });
  return { id: agent.id, fingerprint: fp };
}

function attachmentsToText(attachments?: Attachment[]): string {
  if (!attachments?.length) return "";
  return (
    "\n\n" +
    attachments
      .map((a) =>
        a.kind === "image"
          ? `[Attached image: ${a.name}]`
          : `[Attached ${a.kind}: ${a.name}]\n\`\`\`\n${a.content}\n\`\`\``,
      )
      .join("\n\n")
  );
}

/**
 * Resolve the session for a conversation: reuse the existing one, or create a
 * fresh session when none exists or the agent changed (skills drifted, since a
 * session is pinned to the agent it was created with).
 */
export async function ensureSession(params: {
  agentId: string;
  sessionId?: string;
  sessionAgentId?: string;
}): Promise<string> {
  if (params.sessionId && params.sessionAgentId === params.agentId) {
    return params.sessionId;
  }
  const envId = await ensureEnvironment();
  const session = await beta.sessions.create({
    agent: params.agentId,
    environment_id: envId,
    title: "Conversation",
  });
  return session.id as string;
}

/**
 * Send one user turn to a session and stream the agent's text via `onText`.
 */
export async function streamTurn(params: {
  sessionId: string;
  userText: string;
  attachments?: Attachment[];
  cueInstruction?: string;
  onText: (delta: string) => void;
}): Promise<void> {
  const content: Array<{ type: "text"; text: string }> = [
    { type: "text", text: params.userText + attachmentsToText(params.attachments) },
  ];
  if (params.cueInstruction) {
    content.push({ type: "text", text: cueOperatorNote(params.cueInstruction) });
  }

  // Stream-first, then send.
  const stream = await beta.sessions.events.stream(params.sessionId);
  await beta.sessions.events.send(params.sessionId, {
    events: [{ type: "user.message", content }],
  });

  for await (const ev of stream) {
    if (ev.type === "agent.message") {
      for (const b of ev.content ?? []) {
        if (b.type === "text" && b.text) params.onText(b.text);
      }
    } else if (ev.type === "session.error") {
      throw new Error(ev.error?.message ?? "session error");
    } else if (ev.type === "session.status_terminated") {
      break;
    } else if (ev.type === "session.status_idle") {
      if (ev.stop_reason?.type !== "requires_action") break;
    }
  }
}
