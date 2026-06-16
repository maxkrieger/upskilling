/**
 * Offline workflow-extraction pipeline for the seeded Profile conversations.
 *
 * The committed profiles carry a hand-tuned `workflowIndex`; this script
 * demonstrates how that index is produced from raw conversations and lets us
 * regenerate / sanity-check it. Run: `npm run extract:offline`.
 */
import { writeFile, mkdir } from "node:fs/promises";
import { jsonCall } from "../server/anthropic.ts";
import { buildExtractUser, EXTRACT_SCHEMA } from "../server/prompts.ts";
import { conversationToText, id } from "../server/util.ts";
import { PROFILES } from "../src/data/index.ts";
import type { WorkflowSet, WorkflowSummary } from "../shared/types.ts";

async function extractProfile(profileId: string) {
  const profile = PROFILES.find((p) => p.id === profileId)!;
  const sets: WorkflowSet[] = [];

  for (const convo of profile.conversations) {
    const res = await jsonCall<{
      summary: string;
      quotes: string[];
      cluster: string;
      isWorkflow: boolean;
    }>({
      system:
        "You extract reusable workflow descriptions from conversations, quoting the user's specific preferences verbatim.",
      user: buildExtractUser({
        conversationText: conversationToText(convo),
        existingClusters: [...new Set(sets.map((s) => s.cluster))],
      }),
      schema: EXTRACT_SCHEMA as unknown as Record<string, unknown>,
    });

    if (!res.isWorkflow) {
      console.log(`  · skipped (not a workflow): "${convo.title}"`);
      continue;
    }

    const summary: WorkflowSummary = {
      conversationId: convo.id,
      summary: res.summary,
      quotes: res.quotes,
      cluster: res.cluster,
    };
    let set = sets.find((s) => s.cluster === res.cluster);
    if (!set) {
      set = {
        id: id("ws"),
        cluster: res.cluster,
        members: [],
        cueStatus: "none",
        updatedAt: convo.updatedAt,
      };
      sets.push(set);
    }
    set.members.push(summary);
    set.updatedAt = convo.updatedAt;
    console.log(`  ✓ [${res.cluster}] ${res.summary}`);
  }

  const overdue = sets.filter((s) => s.members.length >= 2);
  console.log(
    `  → ${sets.length} cluster(s), ${overdue.length} overdue for a skill (${overdue
      .map((s) => s.cluster)
      .join(", ")})`,
  );
  return sets;
}

async function main() {
  const out: Record<string, WorkflowSet[]> = {};
  for (const p of PROFILES) {
    console.log(`\n=== ${p.emoji} ${p.name} (${p.id}) ===`);
    out[p.id] = await extractProfile(p.id);
  }
  await mkdir("eval-results", { recursive: true });
  await writeFile("eval-results/extracted-index.json", JSON.stringify(out, null, 2));
  console.log("\nWrote eval-results/extracted-index.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
