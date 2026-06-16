/**
 * Offline evaluation of the Skill cueing decider and skill quality.
 *
 *  - Cueing: precision / recall / F1 over a labeled dataset (scripts/eval-cases.ts).
 *  - Skill quality: for accepted-cluster cases, generate the skill and check that
 *    it captures the key verbatim preferences from the workflow evidence.
 *
 * Run: `npm run eval`.
 */
import { writeFile, mkdir } from "node:fs/promises";
import { decideCue } from "../server/cue.ts";
import { jsonCall } from "../server/anthropic.ts";
import { buildSkillCreatorSystem, buildSkillCreatorUser, SKILL_SCHEMA } from "../server/prompts.ts";
import { getProfile } from "../src/data/index.ts";
import { CUE_CASES } from "./eval-cases.ts";

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

/** Check that a generated skill captures the workflow's key preference terms. */
async function evalSkillQuality() {
  console.log("\n=== Skill quality (key-preference coverage) ===");
  const targets = [
    { profileId: "analyst", cluster: "deck-bar-charts", keys: ["gridlin", "legend", "sort", "palette"] },
    { profileId: "lawyer", cluster: "nda-review", keys: ["mutual", "clause", "risk", "non-solicit"] },
    { profileId: "social", cluster: "instagram-art-caption", keys: ["hashtag", "em dash", "highbrow", "grandi"] },
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
    const hay = (skill.name + " " + skill.description + " " + skill.instructions).toLowerCase();
    const missing = t.keys.filter((k) => !hay.includes(k));
    const coverage = (t.keys.length - missing.length) / t.keys.length;
    out.push({ cluster: t.cluster, coverage, missing });
    console.log(
      `  ${coverage === 1 ? "✓" : "△"} ${t.cluster}: coverage=${coverage.toFixed(2)} "${skill.name}"` +
        (missing.length ? ` (missing: ${missing.join(", ")})` : ""),
    );
  }
  const avg = out.reduce((a, b) => a + b.coverage, 0) / out.length;
  console.log(`\n  avg key-preference coverage=${avg.toFixed(3)}`);
  return { skills: out, avgCoverage: avg };
}

async function main() {
  const cueing = await evalCueing();
  const quality = await evalSkillQuality();
  await mkdir("eval-results", { recursive: true });
  await writeFile(
    "eval-results/eval.json",
    JSON.stringify({ cueing, quality, at: new Date().toISOString() }, null, 2),
  );
  console.log("\nWrote eval-results/eval.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
