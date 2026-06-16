import type { Profile } from "../../../shared/types.ts";

// ---- Attached documents (referenced by presets/conversations by name) ----

const ACME_NDA = `MUTUAL NON-DISCLOSURE AGREEMENT

This Agreement is entered into between Acme Robotics, Inc. ("Disclosing Party")
and the Recipient.

1. CONFIDENTIAL INFORMATION. "Confidential Information" means any non-public
   information disclosed by either party, in any form.

2. TERM. The confidentiality obligations herein shall survive in perpetuity.

3. GOVERNING LAW. This Agreement shall be governed by the laws of the State of
   New York, without regard to conflicts of law principles.

4. NON-SOLICITATION. For a period of twenty-four (24) months, Recipient shall
   not solicit for employment any employee of the Disclosing Party.

5. INJUNCTIVE RELIEF. The Disclosing Party shall be entitled to injunctive
   relief without the posting of any bond.`;

const VENDOR_NDA = `NON-DISCLOSURE AGREEMENT

Between Northwind Systems LLC and Recipient.

1. SCOPE. Recipient agrees to keep confidential all information marked
   "Confidential" or that a reasonable person would understand to be confidential.

2. ONE-WAY OBLIGATIONS. Only the Recipient is bound by confidentiality; the
   Disclosing Party assumes no reciprocal obligations.

3. TERM. Obligations continue for seven (7) years from the date of disclosure.

4. GOVERNING LAW. Governed by the laws of Delaware.

5. ASSIGNMENT. Disclosing Party may assign this Agreement to any successor
   without notice to or consent of Recipient.`;

const OFFER_LETTER = `EMPLOYMENT OFFER LETTER

Dear Candidate,

We are pleased to offer you the position of Senior Engineer at Helio Labs, Inc.

- Base Salary: $185,000/year
- Equity: 12,000 ISOs vesting over 4 years, 1-year cliff
- At-Will Employment: Your employment is at-will and may be terminated at any time.
- Non-Compete: For 12 months following termination, you agree not to work for
  any competing business anywhere in the United States.
- Arbitration: All disputes shall be resolved by binding arbitration; you waive
  the right to a jury trial and to participate in any class action.`;

/**
 * Corporate Counsel persona. Primary workflow cluster: NDA review with a fixed
 * house standard (must be mutual, governed by CA or DE, clause-by-clause table,
 * per-clause risk rating, no non-solicit riders, flag off-market terms). Two
 * prior NDA-review conversations repeat those preferences verbatim, making the
 * cluster "overdue" for a skill, so a matching preset prompt triggers a cue.
 */
export const lawyerProfile: Profile = {
  id: "lawyer",
  name: "Corporate Counsel",
  role: "Reviews NDAs and commercial contracts against a fixed in-house playbook.",
  blurb:
    "Lives in redlines and risk tables. Has a consistent, repeated checklist for how NDAs must be reviewed.",
  emoji: "⚖️",

  attachments: [
    { id: "att_acme_nda", name: "acme_nda.txt", kind: "text", content: ACME_NDA },
    { id: "att_vendor_nda", name: "vendor_nda.txt", kind: "text", content: VENDOR_NDA },
    { id: "att_offer", name: "helio_offer_letter.txt", kind: "text", content: OFFER_LETTER },
  ],

  presets: [
    {
      id: "p_law_1",
      title: "Review an NDA",
      subtitle: "Against the in-house standard",
      prompt:
        "Review this NDA against our standard: it must be mutual, governed by California or Delaware, give me a clause-by-clause table that rates the risk of each clause, no non-solicit riders, and flag any off-market clauses.",
      attachmentRefs: ["acme_nda.txt"],
    },
    {
      id: "p_law_2",
      title: "Review a vendor NDA",
      subtitle: "Same playbook, new counterparty",
      prompt:
        "Run our usual NDA review on this vendor agreement — mutual, CA or DE governing law, clause-by-clause risk table, no non-solicit, flag off-market terms.",
      attachmentRefs: ["vendor_nda.txt"],
    },
    {
      id: "p_law_3",
      title: "Statute of limitations question",
      subtitle: "One-off question",
      prompt:
        "What's the statute of limitations for a breach of written contract claim in California?",
    },
  ],

  // Shown once the user has an active NDA-review skill — terse asks that let the
  // skill run the whole playbook.
  loosePresets: [
    {
      id: "p_law_l1",
      title: "Signable as-is?",
      subtitle: "Your NDA playbook runs automatically",
      prompt: "New NDA from Acme just landed — run it and tell me if it's signable.",
      attachmentRefs: ["acme_nda.txt"],
    },
    {
      id: "p_law_l2",
      title: "Quick risk read",
      subtitle: "Your NDA playbook runs automatically",
      prompt: "Quick risk read on this vendor NDA before I forward it.",
      attachmentRefs: ["vendor_nda.txt"],
    },
    {
      id: "p_law_l3",
      title: "Statute of limitations question",
      subtitle: "One-off question",
      prompt:
        "What's the statute of limitations for a breach of written contract claim in California?",
    },
  ],

  conversations: [
    // --- Cluster: nda-review (member 1) ---
    {
      id: "c_law_nda1",
      profileId: "lawyer",
      title: "Acme NDA review",
      createdAt: "2026-05-06T14:05:00.000Z",
      updatedAt: "2026-05-06T14:12:00.000Z",
      messages: [
        {
          id: "m1",
          role: "user",
          content:
            "Review this NDA. As always: it needs to be mutual, governed by California or Delaware, give me a clause-by-clause table that rates the risk of each clause, no non-solicit riders, and flag anything off-market.",
          createdAt: "2026-05-06T14:05:00.000Z",
          attachments: [
            { id: "a1", name: "acme_nda.txt", kind: "text", content: ACME_NDA },
          ],
        },
        {
          id: "m2",
          role: "assistant",
          content:
            "Here's the clause-by-clause review against your standard. Headline issues: it's **one-way (not mutual)**, governed by **New York** (not CA/DE), it has a **24-month non-solicit** you don't allow, and a **perpetual term**, which is off-market.\n\n| # | Clause | Summary | Risk | Notes vs. standard |\n|---|--------|---------|------|--------------------|\n| 1 | Confidential Information | Broad, any form | Low | Acceptable |\n| 2 | Term | Survives in perpetuity | **High** | Off-market — cap at 3–5 yrs |\n| 3 | Governing Law | New York | **High** | Must be CA or DE — reject |\n| 4 | Non-Solicitation | 24-mo no-hire | **High** | Strike rider entirely |\n| 5 | Injunctive Relief | No bond required | Medium | Common but make mutual |\n\nOverall this is **one-way**; we require it to be mutual. Want me to draft the redline strikes for clauses 2–4?",
          createdAt: "2026-05-06T14:10:00.000Z",
        },
        {
          id: "m3",
          role: "user",
          content: "Yes, redline 2, 3, and 4, and make the whole thing mutual.",
          createdAt: "2026-05-06T14:11:00.000Z",
        },
        {
          id: "m4",
          role: "assistant",
          content:
            "Done. Redlines: (2) replaced 'in perpetuity' with 'for three (3) years from disclosure'; (3) replaced 'State of New York' with 'State of Delaware'; (4) deleted the non-solicitation clause in full; and I converted all 'Disclosing Party / Recipient' language to reciprocal 'each party' obligations to make it mutual. The off-market flags are resolved.",
          createdAt: "2026-05-06T14:12:00.000Z",
        },
      ],
    },
    // --- Cluster: nda-review (member 2) ---
    {
      id: "c_law_nda2",
      profileId: "lawyer",
      title: "Northwind vendor NDA",
      createdAt: "2026-05-21T10:40:00.000Z",
      updatedAt: "2026-05-21T10:47:00.000Z",
      messages: [
        {
          id: "m1",
          role: "user",
          content:
            "Same NDA review as usual on this vendor one — mutual, governed by Delaware or California, clause-by-clause table with a risk rating, no non-solicit, and flag off-market clauses.",
          createdAt: "2026-05-21T10:40:00.000Z",
          attachments: [
            { id: "a1", name: "vendor_nda.txt", kind: "text", content: VENDOR_NDA },
          ],
        },
        {
          id: "m2",
          role: "assistant",
          content:
            "Clause-by-clause review below. Good news: governing law is **Delaware**, which meets your standard. But it's **one-way** (clause 2), the **7-year term** is on the long side, and clause 5 has an **off-market unrestricted assignment** right.\n\n| # | Clause | Summary | Risk | Notes vs. standard |\n|---|--------|---------|------|--------------------|\n| 1 | Scope | Marked + reasonable-person | Low | Acceptable |\n| 2 | Obligations | One-way only | **High** | Must be mutual |\n| 3 | Term | 7 years | Medium | Prefer 3–5 yrs |\n| 4 | Governing Law | Delaware | Low | Meets standard |\n| 5 | Assignment | Assign w/o consent | **High** | Off-market — add consent |\n\nNo non-solicit rider present, so nothing to strike there. Want me to make clause 2 mutual and add a consent requirement to clause 5?",
          createdAt: "2026-05-21T10:45:00.000Z",
        },
      ],
    },
    // --- Cluster: employment-agreement-review (member 1; not yet repeated) ---
    {
      id: "c_law_emp1",
      profileId: "lawyer",
      title: "Helio offer letter review",
      createdAt: "2026-05-14T16:20:00.000Z",
      updatedAt: "2026-05-14T16:26:00.000Z",
      messages: [
        {
          id: "m1",
          role: "user",
          content:
            "Review this employment offer letter for enforceability risk, focusing on the restrictive covenants. We're a California employer.",
          createdAt: "2026-05-14T16:20:00.000Z",
          attachments: [
            { id: "a1", name: "helio_offer_letter.txt", kind: "text", content: OFFER_LETTER },
          ],
        },
        {
          id: "m2",
          role: "assistant",
          content:
            "Two big problems for a California employer:\n\n- **Non-Compete (12 months, US-wide):** Generally **void and unenforceable** in California under Bus. & Prof. Code § 16600. Recommend striking it entirely.\n- **Class-action waiver / jury waiver in arbitration:** Pre-dispute jury waivers are unenforceable in CA; the arbitration clause needs PAGA carve-out review post-*Viking River*.\n\nThe at-will language, salary, and ISO vesting terms are standard. Want a redlined version that removes the non-compete and revises the arbitration clause?",
          createdAt: "2026-05-14T16:24:00.000Z",
        },
      ],
    },
    // --- Spurious / personal Q&A (should NOT cue) ---
    {
      id: "c_law_spur1",
      profileId: "lawyer",
      title: "Statute of limitations",
      createdAt: "2026-05-16T09:12:00.000Z",
      updatedAt: "2026-05-16T09:14:00.000Z",
      messages: [
        {
          id: "m1",
          role: "user",
          content:
            "What's the statute of limitations for a breach of an oral contract in California?",
          createdAt: "2026-05-16T09:12:00.000Z",
        },
        {
          id: "m2",
          role: "assistant",
          content:
            "In California, the statute of limitations for breach of an **oral contract** is **2 years** (Code Civ. Proc. § 339). For a **written contract** it's **4 years** (§ 337). This is general information, not legal advice for a specific matter.",
          createdAt: "2026-05-16T09:13:00.000Z",
        },
      ],
    },
    {
      id: "c_law_spur2",
      profileId: "lawyer",
      title: "CLE deadline",
      createdAt: "2026-05-19T08:05:00.000Z",
      updatedAt: "2026-05-19T08:06:00.000Z",
      messages: [
        {
          id: "m1",
          role: "user",
          content:
            "When is the California MCLE compliance deadline, and how many hours do I need?",
          createdAt: "2026-05-19T08:05:00.000Z",
        },
        {
          id: "m2",
          role: "assistant",
          content:
            "California requires **25 hours of MCLE every 3 years**, including at least 4 hours of ethics, 1 hour on competence/substance abuse, and 1 hour on implicit bias. Your compliance deadline depends on your bar number group — check your group's reporting date on the State Bar site.",
          createdAt: "2026-05-19T08:05:40.000Z",
        },
      ],
    },
  ],

  // Pre-extracted offline (see scripts/extract-profiles.ts to regenerate).
  workflowIndex: [
    {
      id: "ws_law_nda",
      cluster: "nda-review",
      cueStatus: "none",
      updatedAt: "2026-05-21T10:47:00.000Z",
      members: [
        {
          conversationId: "c_law_nda1",
          summary:
            "Reviewed the Acme NDA against the house standard; required it be 'mutual', 'governed by California or Delaware', a 'clause-by-clause table' that 'rates the risk of each clause', 'no non-solicit riders', and to 'flag anything off-market'.",
          quotes: [
            "mutual",
            "governed by California or Delaware",
            "clause-by-clause table",
            "rates the risk of each clause",
            "no non-solicit riders",
            "flag anything off-market",
          ],
          cluster: "nda-review",
        },
        {
          conversationId: "c_law_nda2",
          summary:
            "Ran the usual NDA review on the Northwind vendor agreement; required 'mutual', 'governed by Delaware or California', a 'clause-by-clause table with a risk rating', 'no non-solicit', and to 'flag off-market clauses'.",
          quotes: [
            "mutual",
            "governed by Delaware or California",
            "clause-by-clause table with a risk rating",
            "no non-solicit",
            "flag off-market clauses",
          ],
          cluster: "nda-review",
        },
      ],
    },
    {
      id: "ws_law_employment",
      cluster: "employment-agreement-review",
      cueStatus: "none",
      updatedAt: "2026-05-14T16:26:00.000Z",
      members: [
        {
          conversationId: "c_law_emp1",
          summary:
            "Reviewed an employment offer letter for 'enforceability risk', focusing on 'restrictive covenants' for a 'California employer' (non-compete and arbitration waivers).",
          quotes: [
            "enforceability risk",
            "restrictive covenants",
            "California employer",
          ],
          cluster: "employment-agreement-review",
        },
      ],
    },
  ],
};
