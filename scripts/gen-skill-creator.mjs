// Generates server/generated/skillCreator.ts from the skill-creator SKILL.md so
// the server can read it WITHOUT node:fs (the Workers runtime has no filesystem).
// Run via `npm run gen:skill` (also runs in prebuild/predeploy).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const md = readFileSync(resolve(root, "lib/skills/skill-creator/SKILL.md"), "utf8");
const out = resolve(root, "server/generated/skillCreator.ts");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(
  out,
  `// AUTO-GENERATED from lib/skills/skill-creator/SKILL.md by scripts/gen-skill-creator.mjs.\n` +
    `// Run \`npm run gen:skill\` after editing that SKILL.md. Do not edit by hand.\n` +
    `export const SKILL_CREATOR_MD = ${JSON.stringify(md)};\n`,
);
console.log(`wrote ${out} (${md.length} chars)`);
