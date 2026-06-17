/**
 * Test: when the user ASSENTS to a skill cue, the model first CONSULTS the
 * skill-creator skill (reads /skills/<slug>/SKILL.md — its tool descriptions
 * require this) and THEN persists via the create_skill tool. Multi-turn is
 * allowed — if the model asks clarifying questions first, we answer and continue.
 * The test requires both: the skill-creator fired, and it fired BEFORE
 * create_skill was called.
 *
 * Mirrors the real /api/chat assembly (same system prompt, container, tools).
 * Run: `npm run test:skill`.
 */
import { buildChatSystem } from "../server/prompts.ts";
import { streamChat } from "../server/anthropic.ts";
import {
  CODE_EXECUTION_TOOL,
  CREATE_SKILL_TOOL,
  deleteSkillRemote,
  getSkillCreatorRef,
  skillContainer,
  SKILLS_BETAS,
  slugBase,
  UPDATE_SKILL_TOOL,
} from "../server/skills.ts";

interface Scenario {
  name: string;
  profileName: string;
  profileRole: string;
  /** Conversation ending in the user's assent to a pending cue. */
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  /** Substrings we expect the authored instructions to capture. */
  expectKeys: string[];
}

const SCENARIOS: Scenario[] = [
  {
    name: "analyst / assent to bar-chart cue",
    profileName: "Maya",
    profileRole: "Data analyst",
    messages: [
      { role: "user", content: "Bar chart of revenue by product for the board deck, usual style." },
      {
        role: "assistant",
        content:
          "Here's the chart in your usual board-deck style — company palette starting #d97757, no gridlines, no legend, bars sorted descending.\n\nI've noticed you ask for bar charts with these same preferences every time. If you'd like, I can capture this as a reusable Skill so you don't have to restate them. Want me to?",
      },
      { role: "user", content: "Yes — go ahead and capture that workflow as a Skill." },
    ],
    expectKeys: ["gridline", "legend", "sort"],
  },
  {
    name: "lawyer / assent to NDA-review cue",
    profileName: "Jordan",
    profileRole: "Corporate counsel",
    messages: [
      { role: "user", content: "Review this inbound NDA before I send it back." },
      {
        role: "assistant",
        content:
          "Done — flags and required edits below. I made it mutual, set governing law to CA or DE, and called out a non-solicit rider as off-market.\n\nYou review inbound NDAs the same way each time. I can capture this as a reusable Skill so it's applied automatically. Want me to?",
      },
      { role: "user", content: "Yes please, save that as a skill." },
    ],
    expectKeys: ["mutual", "non-solicit"],
  },
];

async function runScenario(
  s: Scenario,
  container: any,
  tools: any[],
  creatorSlug: string,
): Promise<boolean> {
  const system = buildChatSystem({ profileName: s.profileName, profileRole: s.profileRole });
  const messages: any[] = s.messages.map((m) => ({ role: m.role, content: m.content }));
  let created: { name: string; description: string; instructions: string } | null = null;
  let creatorFired = false;
  let creatorFiredBeforeCreate = false;

  for (let attempt = 1; attempt <= 4 && !created; attempt++) {
    let text = "";
    await streamChat({
      system,
      messages,
      maxTokens: 4000,
      container,
      tools,
      betas: SKILLS_BETAS,
      handlers: {
        onText: (d) => {
          text += d;
        },
        // The model read a mounted skill — note when it's the skill-creator.
        onSkillFired: (slug) => {
          if (slug === creatorSlug || slugBase(slug) === slugBase(creatorSlug)) creatorFired = true;
        },
        // Record the persist call (don't actually register — keeps the org clean).
        onToolUse: async (name, input) => {
          if (name === "create_skill") {
            created = input;
            creatorFiredBeforeCreate = creatorFired; // must have fired first
          }
          return `Saved. "${input?.name}" is active.`;
        },
      },
    });
    if (created) break;
    // The model asked something instead of creating — answer and continue.
    console.log(`    turn ${attempt}: no tool yet; model said: ${JSON.stringify(text.slice(0, 100))}`);
    messages.push({ role: "assistant", content: text || "(thinking)" });
    messages.push({
      role: "user",
      content: "Yes, those defaults are all correct — go ahead and create it now.",
    });
  }

  if (!created) {
    console.log(`  ✗ ${s.name}: create_skill was NOT called within 4 turns`);
    return false;
  }
  if (!creatorFiredBeforeCreate) {
    console.log(
      `  ✗ ${s.name}: create_skill was called WITHOUT the skill-creator firing first` +
        ` (creatorFired=${creatorFired})`,
    );
    return false;
  }
  const c = created as { name: string; description: string; instructions: string };
  const hay = `${c.name} ${c.description} ${c.instructions}`.toLowerCase();
  const missing = s.expectKeys.filter((k) => !hay.includes(k.toLowerCase()));
  console.log(
    `  ✓ ${s.name}: skill-creator fired → create_skill "${c.name}"` +
      (missing.length ? ` (note: missing keys ${missing.join(", ")})` : " (captured all key prefs)"),
  );
  return true;
}

async function main() {
  console.log("Mounting skill-creator + tools (mirrors /api/chat)…");
  const creatorRef = await getSkillCreatorRef();
  const container = skillContainer([], creatorRef);
  const tools = [CODE_EXECUTION_TOOL, CREATE_SKILL_TOOL, UPDATE_SKILL_TOOL];

  let pass = 0;
  try {
    for (const s of SCENARIOS) {
      console.log(`\n### ${s.name}`);
      if (await runScenario(s, container, tools, creatorRef.slug)) pass++;
    }
  } finally {
    await deleteSkillRemote(creatorRef.skill_id);
  }

  console.log(
    `\n==== ${pass}/${SCENARIOS.length} cue-assent flows: skill-creator fired then persisted via create_skill ====`,
  );
  if (pass < SCENARIOS.length) process.exit(1);
}

main().catch((e) => {
  console.error("TEST ERROR:", e);
  process.exit(1);
});
