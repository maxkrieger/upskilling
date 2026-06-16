import type { Skill, WorkflowSet } from "../shared/types.ts";
import { getProfile } from "../src/data/index.ts";

/** A labeled cueing test case. */
export interface CueCase {
  name: string;
  profileId: string;
  userMessage: string;
  /** Workflow index state at decision time. */
  index: WorkflowSet[];
  skills?: Skill[];
  /** Ground truth: should the system cue a skill? */
  expectCue: boolean;
}

const analyst = () => getProfile("analyst")!;
const lawyer = () => getProfile("lawyer")!;
const social = () => getProfile("social")!;

/** Helper: clone a profile's index and patch a set's cueStatus. */
function indexWith(profileId: string, patch?: (sets: WorkflowSet[]) => void): WorkflowSet[] {
  const sets = (getProfile(profileId)!.workflowIndex ?? []).map((s) => ({
    ...s,
    members: [...s.members],
  }));
  patch?.(sets);
  return sets;
}

export const CUE_CASES: CueCase[] = [
  // ---- Positives: matches an overdue (>=2 member) cluster, status none ----
  {
    name: "analyst/new bar chart matches overdue chart cluster",
    profileId: "analyst",
    userMessage: "Bar chart of churn by segment for the QBR slide, usual style.",
    index: indexWith("analyst"),
    expectCue: true,
  },
  {
    name: "lawyer/new NDA review matches overdue nda cluster",
    profileId: "lawyer",
    userMessage: "Can you review this NDA for me before I send it back?",
    index: indexWith("lawyer"),
    expectCue: true,
  },
  {
    name: "social/new caption matches overdue caption cluster",
    profileId: "social",
    userMessage:
      "Write an Instagram caption for a new oil painting by Mara Velasco we're showing.",
    index: indexWith("social"),
    expectCue: true,
  },

  // ---- Negatives: spurious / personal / Q&A ----
  {
    name: "analyst/personal stats question (no workflow)",
    profileId: "analyst",
    userMessage: "What's the difference between standard deviation and standard error?",
    index: indexWith("analyst"),
    expectCue: false,
  },
  {
    name: "lawyer/general legal trivia",
    profileId: "lawyer",
    userMessage: "What's the statute of limitations on breach of contract in California?",
    index: indexWith("lawyer"),
    expectCue: false,
  },
  {
    name: "social/best time to post (no workflow)",
    profileId: "social",
    userMessage: "What's the best time of day to post on Instagram for engagement?",
    index: indexWith("social"),
    expectCue: false,
  },

  // ---- Negatives: already accepted/rejected -> never re-cue ----
  {
    name: "analyst/chart cluster already accepted",
    profileId: "analyst",
    userMessage: "Bar chart of revenue by product, usual style.",
    index: indexWith("analyst", (sets) => {
      const s = sets.find((x) => x.cluster === "deck-bar-charts");
      if (s) {
        s.cueStatus = "accepted";
        s.skillId = "skill_existing";
      }
    }),
    skills: [
      {
        id: "skill_existing",
        name: "Deck Bar Charts",
        description: "Bar charts in house style.",
        instructions: "...",
        source: "user",
        enabled: true,
        createdAt: "2026-05-21T00:00:00.000Z",
      },
    ],
    expectCue: false,
  },
  {
    name: "lawyer/nda cluster already rejected",
    profileId: "lawyer",
    userMessage: "Review this NDA for me.",
    index: indexWith("lawyer", (sets) => {
      const s = sets.find((x) => x.cluster === "nda-review");
      if (s) s.cueStatus = "rejected";
    }),
    expectCue: false,
  },

  // ---- Negative: brand-new workflow, no prior occurrence ----
  {
    name: "analyst/first-ever SQL request (empty index)",
    profileId: "analyst",
    userMessage: "Write a SQL query to compute 7-day retention from an events table.",
    index: [],
    expectCue: false,
  },
];
