/**
 * Offline evaluation of the Skill cueing decider and skill quality.
 *
 *  - Cueing: precision / recall / F1 over a labeled dataset (scripts/eval-cases.ts).
 *  - Skill quality: for accepted-cluster cases, generate the skill and check that
 *    it captures the key verbatim preferences from the workflow evidence.
 *  - Button-press flow: for every sample prompt in each profile, run the cue
 *    decider; for create cues, simulate pressing "Create Skill" (the assent) and
 *    verify the skill-creator fires then create_skill is called.
 *
 * Run: `npm run eval`.
 */
import { writeFile, mkdir } from "node:fs/promises";
import { decideCue } from "../server/cue.ts";
import { jsonCall, streamChat } from "../server/anthropic.ts";
import {
  buildChatSystem,
  buildSkillCreatorSystem,
  buildSkillCreatorUser,
  SKILL_SCHEMA,
} from "../server/prompts.ts";
import {
  CODE_EXECUTION_TOOL,
  CREATE_SKILL_TOOL,
  deleteSkillRemote,
  getSkillCreatorRef,
  registerSkill,
  skillContainer,
  SKILLS_BETAS,
  slugBase,
  UPDATE_SKILL_TOOL,
} from "../server/skills.ts";
import { toAnthropicMessages } from "../server/util.ts";
import { getProfile } from "../src/data/index.ts";
import type { Attachment, PresetPrompt, Profile, Skill, WorkflowSet } from "../shared/types.ts";
import { normalizeCluster, upsertSummary } from "../shared/workflow.ts";
import { CUE_CASES } from "./eval-cases.ts";

/**
 * Deterministic guard for the cluster-drift re-cue bug: re-extracting a workflow
 * (even with a drifted cluster label) must NOT fork a new "none" set and re-cue
 * a skill the user already created. Pure logic — no API calls.
 */
function evalIndexUpsert() {
  console.log("\n=== Index upsert (cluster-drift re-cue guard) ===");
  const member = (conversationId: string, cluster: string) => ({ conversationId, cluster, summary: "s", quotes: [] });
  const accepted = (): WorkflowSet[] => [
    {
      id: "X",
      cluster: "deck-bar-charts",
      cueStatus: "accepted",
      skillId: "sk_x",
      members: [member("cA", "deck-bar-charts")],
      updatedAt: "t",
    },
  ];
  const newId = () => "ws_new";
  const checks: Array<[string, boolean]> = [];

  // A) Re-extracting the same conversation with a drifted label stays in the
  //    accepted set (membership join) — no new set, status preserved.
  const a = upsertSummary(accepted(), member("cA", "Deck Bar Charts"), "cA", newId, "t2");
  checks.push([
    "re-extraction drift stays in the accepted set",
    a.length === 1 && a[0].cueStatus === "accepted" && a[0].skillId === "sk_x" &&
      a[0].members.filter((m) => m.conversationId === "cA").length === 1,
  ]);

  // B) A NEW conversation with case/punctuation drift joins via normalized cluster.
  const b = upsertSummary(accepted(), member("cB", "deck_bar_charts"), "cB", newId, "t2");
  checks.push([
    "normalized cluster joins accepted set (no new 'none' set)",
    b.length === 1 && b[0].cueStatus === "accepted" &&
      b[0].members.some((m) => m.conversationId === "cB") && b[0].members.some((m) => m.conversationId === "cA"),
  ]);

  // C) A genuinely different workflow makes a fresh "none" set.
  const c = upsertSummary(accepted(), member("cC", "weekly-summary"), "cC", newId, "t2");
  const fresh = c.find((s) => s.id === "ws_new");
  checks.push(["genuinely new workflow creates a 'none' set", c.length === 2 && fresh?.cueStatus === "none"]);

  checks.push(["normalizeCluster collapses case/punctuation", normalizeCluster("Deck_Bar Charts!") === "deck-bar-charts"]);

  let pass = 0;
  for (const [name, ok] of checks) {
    console.log(`  ${ok ? "✓" : "✗"} ${name}`);
    if (ok) pass++;
  }
  if (pass < checks.length) throw new Error(`index-upsert regression: ${pass}/${checks.length} passed`);
  return { pass, total: checks.length };
}

/** Resolve a preset's attachmentRefs against the profile's shared assets. */
function resolveAtts(profile: Profile, preset: PresetPrompt): Attachment[] {
  return (preset.attachmentRefs ?? [])
    .map((n) => profile.attachments.find((a) => a.name === n))
    .filter((a): a is Attachment => !!a);
}

interface Row {
  name: string;
  expected: boolean;
  predicted: boolean;
  correct: boolean;
}

/** Map with bounded concurrency to respect connection rate limits. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

async function evalCueing() {
  const rows: Row[] = await mapLimit(CUE_CASES, 1, async (c) => {
    const decision = await decideCue({
      userMessage: c.userMessage,
      workflowIndex: c.index,
      skills: c.skills ?? [],
    });
    const predicted = !!decision.shouldCue;
    return {
      name: c.name,
      expected: c.expectCue,
      predicted,
      correct: predicted === c.expectCue,
    } satisfies Row;
  });

  let tp = 0,
    fp = 0,
    fn = 0,
    tn = 0;
  for (const r of rows) {
    if (r.expected && r.predicted) tp++;
    else if (!r.expected && r.predicted) fp++;
    else if (r.expected && !r.predicted) fn++;
    else tn++;
  }
  const precision = tp + fp ? tp / (tp + fp) : 1;
  const recall = tp + fn ? tp / (tp + fn) : 1;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  const accuracy = rows.filter((r) => r.correct).length / rows.length;

  console.log("\n=== Cueing decider ===");
  for (const r of rows) {
    const mark = r.correct ? "✓" : "✗";
    console.log(
      `  ${mark} [exp ${r.expected ? "cue " : "skip"} | got ${r.predicted ? "cue " : "skip"}] ${r.name}`,
    );
  }
  console.log(
    `\n  TP=${tp} FP=${fp} FN=${fn} TN=${tn}` +
      `\n  precision=${precision.toFixed(3)} recall=${recall.toFixed(3)} ` +
      `F1=${f1.toFixed(3)} accuracy=${accuracy.toFixed(3)}`,
  );

  return { rows, metrics: { tp, fp, fn, tn, precision, recall, f1, accuracy } };
}

const COVERAGE_SCHEMA = {
  type: "object",
  properties: {
    verdicts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          concept: { type: "string" },
          captured: { type: "boolean" },
          evidence: { type: "string", description: "Brief quote/paraphrase from the skill, or why it's missing." },
        },
        required: ["concept", "captured", "evidence"],
        additionalProperties: false,
      },
    },
  },
  required: ["verdicts"],
  additionalProperties: false,
} as const;

/** Judge (semantically, paraphrase-tolerant) whether a skill captures each concept. */
async function judgeConceptCoverage(
  skillText: string,
  concepts: string[],
): Promise<Array<{ concept: string; captured: boolean }>> {
  const res = await jsonCall<{ verdicts: Array<{ concept: string; captured: boolean }> }>({
    system:
      "You judge whether a Skill's instructions capture each required behavior/preference. Match on MEANING, not exact words — a faithful paraphrase counts as captured. Be strict only about whether the behavior is actually specified.",
    user: `## Skill\n${skillText}\n\n## Concepts to check\n${concepts
      .map((c, i) => `${i + 1}. ${c}`)
      .join("\n")}\n\nFor each concept, decide if the skill captures it (paraphrase is fine).`,
    schema: COVERAGE_SCHEMA as unknown as Record<string, unknown>,
  });
  return res.verdicts ?? [];
}

/** Check that a generated skill captures the workflow's key preferences (semantic). */
async function evalSkillQuality() {
  console.log("\n=== Skill quality (semantic concept coverage) ===");
  const targets = [
    {
      profileId: "analyst",
      cluster: "deck-bar-charts",
      concepts: [
        "bars sorted in descending order",
        "no gridlines",
        "no legend",
        "the company palette starting with the clay-orange #d97757",
      ],
    },
    {
      profileId: "lawyer",
      cluster: "nda-review",
      concepts: [
        "NDAs must be mutual",
        "governing law limited to California or Delaware",
        "no non-solicit riders",
        "output flags + required edits rather than a clause-by-clause table",
      ],
    },
    {
      profileId: "social",
      cluster: "instagram-art-caption",
      concepts: [
        "include relevant hashtags",
        "no em dashes",
        "a highbrow / sophisticated audience voice",
        "avoid LLM grandiosity / slop",
      ],
    },
  ];

  const out: Array<{ cluster: string; coverage: number; missing: string[] }> = [];
  for (const t of targets) {
    const profile = getProfile(t.profileId)!;
    const wfSet = profile.workflowIndex.find((s) => s.cluster === t.cluster)!;
    const conversations = profile.conversations.filter((c) =>
      wfSet.members.some((m) => m.conversationId === c.id),
    );
    const skill = await jsonCall<{ name: string; description: string; instructions: string }>({
      system: buildSkillCreatorSystem(),
      user: buildSkillCreatorUser({ workflowSet: wfSet, conversations }),
      schema: SKILL_SCHEMA as unknown as Record<string, unknown>,
    });
    const skillText = `${skill.name}\n${skill.description}\n${skill.instructions}`;
    const verdicts = await judgeConceptCoverage(skillText, t.concepts);
    const missing = verdicts.filter((v) => !v.captured).map((v) => v.concept);
    const coverage = (t.concepts.length - missing.length) / t.concepts.length;
    out.push({ cluster: t.cluster, coverage, missing });
    console.log(
      `  ${coverage === 1 ? "✓" : "△"} ${t.cluster}: coverage=${coverage.toFixed(2)} "${skill.name}"` +
        (missing.length ? ` (missing: ${missing.join("; ")})` : ""),
    );
  }
  const avg = out.reduce((a, b) => a + b.coverage, 0) / out.length;
  console.log(`\n  avg concept coverage=${avg.toFixed(3)}`);
  return { skills: out, avgCoverage: avg };
}

/**
 * Simulate pressing "Create Skill" after a sample prompt: build the conversation
 * as it stands when the button appears (prompt → cue-offer reply → the assent
 * the button injects), then run the real chat assembly and require the
 * skill-creator to fire BEFORE create_skill is called.
 */
async function simulateButtonPress(
  profile: Profile,
  preset: PresetPrompt,
  preferences: string | undefined,
  container: unknown,
  tools: unknown[],
  creatorSlug: string,
  registerCreated: boolean,
): Promise<{ created: boolean; creatorFiredFirst: boolean; skill: Skill | null }> {
  const system = buildChatSystem({ profileName: profile.name, profileRole: profile.role });
  const messages: any[] = toAnthropicMessages([
    { role: "user", content: preset.prompt, attachments: resolveAtts(profile, preset) },
    {
      role: "assistant",
      content: `Here you go.\n\nI've noticed you keep asking for this with the same preferences (${preferences ?? "your usual setup"}). I can capture it as a reusable Skill so you don't have to restate them. Want me to?`,
    },
    { role: "user", content: "Yes — go ahead and capture that workflow as a Skill." },
  ]);
  let created = false;
  let creatorFired = false;
  let creatorFiredFirst = false;
  let skill: Skill | null = null;
  for (let attempt = 0; attempt < 3 && !created; attempt++) {
    let text = "";
    await streamChat({
      system,
      messages,
      maxTokens: 4000,
      container,
      tools,
      betas: SKILLS_BETAS,
      handlers: {
        onText: (d) => (text += d),
        onSkillFired: (slug) => {
          if (slug === creatorSlug || slugBase(slug) === slugBase(creatorSlug)) creatorFired = true;
        },
        onToolUse: async (name, input) => {
          if (name === "create_skill") {
            created = true;
            creatorFiredFirst = creatorFired;
            // Register for real so the loose-fire phase can mount + trigger it.
            if (registerCreated && !skill) {
              const reg = await registerSkill(input);
              skill = {
                id: `eval_${reg.slug}`,
                name: input.name,
                description: input.description,
                instructions: input.instructions,
                source: "user",
                enabled: true,
                createdAt: new Date().toISOString(),
                skillId: reg.skillId,
                skillVersion: reg.skillVersion,
                slug: reg.slug,
              };
            }
          }
          return `Saved. "${input?.name}" is active.`;
        },
      },
    });
    if (created) break;
    messages.push({ role: "assistant", content: text || "(thinking)" });
    messages.push({ role: "user", content: "Yes, go ahead and create it now." });
  }
  return { created, creatorFiredFirst, skill };
}

/** Does a preset (with its attachments) cause `targetSlug`'s skill to fire? */
async function askFires(
  profile: Profile,
  preset: PresetPrompt,
  container: unknown,
  targetSlug: string,
): Promise<boolean> {
  let fired = false;
  await streamChat({
    system: buildChatSystem({ profileName: profile.name, profileRole: profile.role }),
    messages: toAnthropicMessages([
      { role: "user", content: preset.prompt, attachments: resolveAtts(profile, preset) },
    ]),
    maxTokens: 2500,
    container,
    tools: [CODE_EXECUTION_TOOL],
    betas: SKILLS_BETAS,
    handlers: {
      onText: () => {},
      onSkillFired: (slug) => {
        if (slug === targetSlug || slugBase(slug) === slugBase(targetSlug)) fired = true;
      },
    },
  });
  return fired;
}

/**
 * Full lifecycle per profile: the workflow presets cue + create a skill (via the
 * button press), then the loose presets must FIRE that created skill.
 */
async function evalLifecycle() {
  console.log("\n=== Skill lifecycle: cue → create (button) → fire on loose asks ===");
  const creatorRef = await getSkillCreatorRef();
  const creatorContainer = skillContainer([], creatorRef);
  const createTools = [CODE_EXECUTION_TOOL, CREATE_SKILL_TOOL, UPDATE_SKILL_TOOL];

  const rows: Array<{ profile: string; phase: string; preset: string; ok: boolean | null; note?: string }> = [];
  const registeredIds: string[] = [];

  try {
    for (const pid of ["analyst", "lawyer", "social"]) {
      const profile = getProfile(pid)!;
      console.log(`\n${pid}:`);
      let createdSkill: Skill | null = null;

      // Phase 1 — presets: workflow prompts (oneOff !== true) must create-cue and
      // create the skill (register the first); one-off prompts must NOT cue.
      for (const preset of profile.presets ?? []) {
        const decision = await decideCue({
          userMessage: preset.prompt,
          workflowIndex: profile.workflowIndex,
          skills: [],
        });
        const isCreate = !!decision.shouldCue && decision.kind === "create" && !!decision.workflowSetId;
        if (preset.oneOff) {
          const ok = !isCreate; // a one-off question must not cue a skill
          console.log(`  ${ok ? "✓" : "✗"} cue    ${preset.title} → ${isCreate ? "create cue" : "no cue"} (expected no cue)`);
          rows.push({ profile: pid, phase: "cue", preset: preset.title, ok, note: "expect-no-cue" });
          continue;
        }
        if (!isCreate) {
          console.log(`  ✗ create ${preset.title} → no create cue (expected create)`);
          rows.push({ profile: pid, phase: "create", preset: preset.title, ok: false, note: "expected-create-cue" });
          continue;
        }
        const r = await simulateButtonPress(
          profile,
          preset,
          decision.preferences,
          creatorContainer,
          createTools,
          creatorRef.slug,
          !createdSkill,
        );
        if (r.skill) {
          createdSkill = r.skill;
          registeredIds.push(r.skill.skillId!);
        }
        const ok = r.created && r.creatorFiredFirst;
        console.log(
          `  ${ok ? "✓" : "✗"} create ${preset.title} → ${r.creatorFiredFirst ? "creator fired" : "creator NOT fired"}` +
            ` / ${r.created ? "create_skill ✓" : "create_skill ✗"}`,
        );
        rows.push({ profile: pid, phase: "create", preset: preset.title, ok });
      }

      // Phase 2 — loose presets: workflow ones must fire the created skill;
      // one-off asks must NOT (the skill shouldn't over-trigger).
      if (createdSkill) {
        const liveContainer = skillContainer([createdSkill], creatorRef);
        for (const loose of profile.loosePresets ?? []) {
          const expectFire = !loose.oneOff;
          const fired = await askFires(profile, loose, liveContainer, createdSkill.slug!);
          const ok = fired === expectFire;
          console.log(
            `  ${ok ? "✓" : "✗"} fire  ${loose.title} → ${fired ? "fired" : "no fire"}` +
              ` (expected ${expectFire ? "fire" : "no fire"})`,
          );
          rows.push({ profile: pid, phase: "fire", preset: loose.title, ok, note: expectFire ? "expect-fire" : "expect-skip" });
        }
      } else {
        console.log("  (no skill created — skipping loose-fire checks)");
      }
    }
  } finally {
    for (const sid of registeredIds) await deleteSkillRemote(sid);
    await deleteSkillRemote(creatorRef.skill_id);
  }

  const presetRows = rows.filter((r) => r.phase === "create" || r.phase === "cue");
  const fires = rows.filter((r) => r.phase === "fire");
  const presetOk = presetRows.filter((r) => r.ok).length;
  const fireOk = fires.filter((r) => r.ok).length;
  console.log(
    `\n  presets (cue + create): ${presetOk}/${presetRows.length}` +
      ` | loose asks (fire vs. no-fire): ${fireOk}/${fires.length}`,
  );
  return { rows, presetOk, presetTotal: presetRows.length, fireOk, fireTotal: fires.length };
}

async function main() {
  const indexUpsert = evalIndexUpsert(); // fast, deterministic — fail early
  const cueing = await evalCueing();
  const quality = await evalSkillQuality();
  const lifecycle = await evalLifecycle();
  await mkdir("eval-results", { recursive: true });
  await writeFile(
    "eval-results/eval.json",
    JSON.stringify({ indexUpsert, cueing, quality, lifecycle, at: new Date().toISOString() }, null, 2),
  );
  console.log("\nWrote eval-results/eval.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
