import type { Profile } from "../../shared/types.ts";
import { analystProfile } from "./profiles/analyst.ts";
import { lawyerProfile } from "./profiles/lawyer.ts";
import { socialProfile } from "./profiles/social.ts";
import { customProfile } from "./profiles/custom.ts";

/** Seeded demo personae, loaded into the SPA on first run. */
export const PROFILES: Profile[] = [analystProfile, lawyerProfile, socialProfile, customProfile];

export function getProfile(id: string): Profile | undefined {
  return PROFILES.find((p) => p.id === id);
}
