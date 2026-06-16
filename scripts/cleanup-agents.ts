/**
 * Clean up Managed Agents resources created by this demo.
 *
 * By default: deletes demo sessions and archives demo agents (those named
 * "Upskilling — ...", plus the probe agents). Skills and the shared environment
 * are left in place unless you opt in.
 *
 *   npm run cleanup:agents            # sessions + agents
 *   npm run cleanup:agents -- --dry   # preview only, change nothing
 *   npm run cleanup:agents -- --skills  # also delete all custom skills
 *   npm run cleanup:agents -- --env     # also delete the shared environment
 *   npm run cleanup:agents -- --all     # sessions + agents + skills + env
 */
import { anthropic } from "../server/anthropic.ts";

const beta = anthropic.beta as any;
const args = new Set(process.argv.slice(2));
const dry = args.has("--dry");
const all = args.has("--all");
const doSkills = all || args.has("--skills");
const doEnv = all || args.has("--env");

const ENV_NAME = "upskilling-demo";
const isDemoAgent = (name?: string | null) =>
  !!name && (name.startsWith("Upskilling") || name.includes("(probe)"));

const tag = dry ? "[dry] would" : "";
let sessions = 0,
  agents = 0,
  skills = 0,
  envs = 0;

async function main() {
  // 1. Sessions — disposable; delete demo ones (and any not yet archived).
  for await (const s of beta.sessions.list({ limit: 100 })) {
    if (s.archived_at) continue;
    if (!isDemoAgent(s.agent?.name)) continue;
    console.log(`${tag} delete session ${s.id} (${s.agent?.name}, ${s.status})`);
    sessions++;
    if (!dry) {
      try {
        await beta.sessions.delete(s.id);
      } catch (e: any) {
        console.log(`   skip: ${e.message}`);
      }
    }
  }

  // 2. Agents — archive (agents have no delete).
  for await (const a of beta.agents.list({ limit: 100 })) {
    if (a.archived_at || !isDemoAgent(a.name)) continue;
    console.log(`${tag} archive agent ${a.id} (${a.name})`);
    agents++;
    if (!dry) {
      try {
        await beta.agents.archive(a.id);
      } catch (e: any) {
        console.log(`   skip: ${e.message}`);
      }
    }
  }

  // 3. Skills (opt-in) — delete all versions then the skill.
  if (doSkills) {
    for await (const sk of beta.skills.list({ limit: 100 })) {
      console.log(`${tag} delete skill ${sk.id} (${sk.display_title})`);
      skills++;
      if (!dry) {
        try {
          for await (const v of beta.skills.versions.list(sk.id)) {
            try {
              await beta.skills.versions.delete(sk.id, v.version);
            } catch {
              /* ignore */
            }
          }
          await beta.skills.delete(sk.id);
        } catch (e: any) {
          console.log(`   skip: ${e.message}`);
        }
      }
    }
  }

  // 4. Environment (opt-in) — delete the shared demo environment.
  if (doEnv) {
    for await (const e of beta.environments.list({ limit: 100 })) {
      if (e.name !== ENV_NAME) continue;
      console.log(`${tag} delete environment ${e.id} (${e.name})`);
      envs++;
      if (!dry) {
        try {
          await beta.environments.delete(e.id);
        } catch (err: any) {
          console.log(`   skip: ${err.message}`);
        }
      }
    }
  }

  console.log(
    `\n${dry ? "Would clean" : "Cleaned"}: ${sessions} session(s), ${agents} agent(s)` +
      (doSkills ? `, ${skills} skill(s)` : "") +
      (doEnv ? `, ${envs} environment(s)` : "") +
      (doSkills || doEnv ? "" : "  (skills + env left; use --skills / --env / --all)"),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
