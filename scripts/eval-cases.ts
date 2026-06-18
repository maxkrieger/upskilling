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

/** A single-member workflow set — represents one workflow seen so far (e.g. the
 * current conversation, extracted per-turn) with no prior-conversation history. */
function oneMember(
  cluster: string,
  conversationId: string,
  m: { summary: string; quotes: string[] },
): WorkflowSet {
  return {
    id: `wf_${cluster}`,
    cluster,
    cueStatus: "none",
    members: [{ conversationId, cluster, summary: m.summary, quotes: m.quotes }],
    updatedAt: "2026-06-15T00:00:00.000Z",
  };
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

  // ---- Update cue: only on an EXPLICIT new standing preference, not mere use ----
  {
    name: "lawyer/ordinary use of an active skill (no new preference) -> no cue",
    profileId: "lawyer",
    userMessage: "Quick risk read on this vendor NDA before I forward it.",
    index: indexWith("lawyer", (sets) => {
      const s = sets.find((x) => x.cluster === "nda-review");
      if (s) {
        s.cueStatus = "accepted";
        s.skillId = "skill_nda";
      }
    }),
    skills: [
      {
        id: "skill_nda",
        name: "NDA Review",
        description: "Reviews inbound NDAs against the house playbook and flags off-market terms.",
        instructions:
          "Make NDAs mutual; CA or DE governing law; no non-solicit riders; flag off-market clauses; output flags + required edits.",
        source: "user",
        enabled: true,
        createdAt: "2026-05-21T00:00:00.000Z",
        skillId: "sk_nda_remote",
        skillVersion: "1",
      },
    ],
    expectCue: false,
  },
  {
    name: "lawyer/explicit new standing preference -> update cue",
    profileId: "lawyer",
    userMessage: "From now on, always also flag any IP assignment clauses when you review these.",
    index: indexWith("lawyer", (sets) => {
      const s = sets.find((x) => x.cluster === "nda-review");
      if (s) {
        s.cueStatus = "accepted";
        s.skillId = "skill_nda";
      }
    }),
    skills: [
      {
        id: "skill_nda",
        name: "NDA Review",
        description: "Reviews inbound NDAs against the house playbook and flags off-market terms.",
        instructions:
          "Make NDAs mutual; CA or DE governing law; no non-solicit riders; flag off-market clauses; output flags + required edits.",
        source: "user",
        enabled: true,
        createdAt: "2026-05-21T00:00:00.000Z",
        skillId: "sk_nda_remote",
        skillVersion: "1",
      },
    ],
    expectCue: true,
  },

  // ---- Negative: brand-new workflow, no prior occurrence ----
  {
    name: "analyst/first-ever SQL request (empty index)",
    profileId: "analyst",
    userMessage: "Write a SQL query to compute 7-day retention from an events table.",
    index: [],
    expectCue: false,
  },

  // ---- Intra-conversation repetition --------------------------------------
  // No prior-conversation history. The current conversation has been extracted
  // per-turn into a single 1-member set. The decider must fire when a SECOND
  // DISTINCT workflow instance appears in the same conversation, but stay quiet
  // when the user is merely refining the one workflow in progress.
  {
    name: "lawyer/second DISTINCT NDA in same convo -> cue",
    profileId: "lawyer",
    userMessage:
      "Different one now — here's the NDA from the design contractor we're onboarding. Can you review this one too?",
    index: [oneMember("nda-review", "c_cur_lawyer", {
      summary:
        "Earlier in this same conversation, reviewed an inbound NDA from a vendor (Acme): wanted it mutual, CA or DE governing law, and flags plus required edits.",
      quotes: ["make it mutual", "California or Delaware", "flag off-market terms"],
    })],
    expectCue: true,
  },
  {
    name: "social/second DISTINCT artwork caption in same convo -> cue",
    profileId: "social",
    userMessage:
      "Great. Now write one for a different piece — a bronze sculpture, \"Aftermath\" by Ines Kovac, 2021.",
    index: [oneMember("instagram-art-caption", "c_cur_social", {
      summary:
        "Earlier in this same conversation, wrote an Instagram caption for an oil painting, with a sophisticated voice and no em dashes.",
      quotes: ["sophisticated audience", "no em dashes", "relevant hashtags"],
    })],
    expectCue: true,
  },
  {
    name: "analyst/refining the SAME chart in convo (add constraints) -> no cue",
    profileId: "analyst",
    userMessage: "Actually, drop the gridlines on that and sort the bars descending.",
    index: [oneMember("deck-bar-charts", "c_cur_analyst", {
      summary:
        "In this conversation, built a bar chart of revenue by product for the QBR deck.",
      quotes: ["bar chart of revenue by product", "for the QBR deck"],
    })],
    expectCue: false,
  },
  {
    name: "lawyer/refining the SAME NDA in convo (add a check) -> no cue",
    profileId: "lawyer",
    userMessage: "Also flag any IP assignment clauses in it while you're at it.",
    index: [oneMember("nda-review", "c_cur_lawyer", {
      summary:
        "In this conversation, reviewing one inbound NDA from a vendor: mutual, CA or DE, flags plus required edits.",
      quotes: ["make it mutual", "California or Delaware"],
    })],
    expectCue: false,
  },
];
