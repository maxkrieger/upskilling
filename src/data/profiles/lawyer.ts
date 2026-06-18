import type { Profile } from "../../../shared/types.ts";

// ---- Attached documents (referenced by presets/conversations by name) ----
//
// NOTE: All contract text below is original synthetic boilerplate authored for
// this demo. It is not copied from any real or published agreement. Each NDA
// deliberately embeds several "off-market" traits the Corporate Counsel persona
// flags in review (one-way obligations, non-CA/DE governing law, perpetual or
// over-long survival, non-solicit riders, broad assignment).

const ACME_NDA = `MUTUAL NON-DISCLOSURE AGREEMENT

This Mutual Non-Disclosure Agreement (this "Agreement") is entered into as of the Effective Date by Acme Robotics, Inc., a Delaware corporation ("Acme"), and the counterparty on the signature page ("Counterparty"), for the purpose of exploring a potential business relationship in autonomous material-handling systems (the "Purpose"). Notwithstanding the title, except where expressly stated to be reciprocal the obligations herein run solely in favor of Acme.

1. DEFINITIONS. "Confidential Information" means all non-public information disclosed by a Party (the "Disclosing Party") to the other (the "Receiving Party"), in any form and whether or not marked, including trade secrets, designs, source code, pricing, business plans, and the terms of this Agreement. "Representatives" means a Party's affiliates and their directors, officers, employees, and advisors.

2. EXCLUSIONS. Confidential Information excludes information the Receiving Party can show by competent written records was (a) already known without restriction, (b) public through no breach, (c) received from a third party without a duty of confidentiality, or (d) independently developed without use of the Confidential Information.

3. OBLIGATIONS OF THE RECEIVING PARTY.
   3.1 The Receiving Party shall protect Confidential Information with at least a reasonable degree of care.
   3.2 It shall disclose only to Representatives with a need to know who are bound by similar obligations, and is responsible for their breaches.
   3.3 It shall use the Confidential Information solely for the Purpose.
   3.4 For the avoidance of doubt, the foregoing obligations apply only to Counterparty as Receiving Party; Acme bears no reciprocal obligation of confidentiality.

4. COMPELLED DISCLOSURE. The Receiving Party may disclose Confidential Information as required by law if, where legally permitted, it gives the Disclosing Party prompt prior notice so it may seek a protective order, and then discloses only the portion legally required.

5. TERM AND SURVIVAL.
   5.1 This Agreement runs from the Effective Date until terminated by either Party on thirty (30) days' written notice.
   5.2 The Receiving Party's confidentiality and non-use obligations survive in perpetuity.

6. RETURN OR DESTRUCTION. On the Disclosing Party's request or on termination, the Receiving Party shall return or destroy all Confidential Information and certify the same, retaining one archival copy solely for compliance.

7. NO LICENSE; NO WARRANTY. No license or right is granted by implication, estoppel, or otherwise, and all Confidential Information is provided "AS IS" without warranty of any kind.

8. GOVERNING LAW; JURISDICTION.
   8.1 This Agreement is governed by the laws of the State of New York, without regard to its conflict-of-laws principles.
   8.2 Each Party submits to the exclusive jurisdiction of the state and federal courts located in New York County, New York.

9. INJUNCTIVE RELIEF; REMEDIES. Acme is entitled to seek injunctive relief for any breach, without the posting of a bond, in addition to all other remedies available.

10. NON-SOLICITATION. For twenty-four (24) months, Counterparty shall not solicit or hire Acme personnel or divert Acme customers.

11. ASSIGNMENT.
    11.1 Acme may assign this Agreement freely and without consent; Counterparty may not assign without Acme's prior written consent.

12. MISCELLANEOUS. Notices shall be in writing; this Agreement is the entire agreement and supersedes prior discussions; if any provision is unenforceable the remainder stays in effect; amendments must be in writing; and this Agreement may be executed in counterparts, each of which is an original and all of which together constitute one and the same instrument.`;

const VENDOR_NDA = `NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement (this "Agreement") is entered into as of the Effective Date by Northwind Systems, LLC ("Vendor") and the disclosing counterparty on the signature page ("Company"), for the purpose of evaluating a potential vendor engagement (the "Purpose"). The confidentiality obligations herein run one way, from Vendor to Company.

1. DEFINITIONS. "Confidential Information" means all non-public information disclosed by Company to Vendor in any form, whether or not marked, including specifications, data, pricing, and business plans. "Representatives" means Vendor's employees and advisors with a need to know.

2. EXCLUSIONS. Confidential Information excludes information that was already known without restriction, is public through no breach, is received from a third party without a duty of confidentiality, or is independently developed without use of the Confidential Information.

3. OBLIGATIONS OF THE RECEIVING PARTY.
   3.1 Vendor shall protect Company's Confidential Information with at least a reasonable degree of care and use it solely for the Purpose.
   3.2 Only Vendor is bound as Receiving Party; Company bears no reciprocal confidentiality obligation with respect to Vendor's information.

4. COMPELLED DISCLOSURE. Vendor may disclose Confidential Information as required by law after giving Company prompt prior notice where legally permitted.

5. TERM AND SURVIVAL.
   5.1 This Agreement begins on the Effective Date and continues for two (2) years.
   5.2 Vendor's confidentiality obligations survive for seven (7) years following disclosure.

6. RETURN OR DESTRUCTION. Vendor shall return or destroy all Confidential Information on Company's request and certify the same.

7. NO LICENSE; NO WARRANTY. No license is granted, and all Confidential Information is provided "AS IS" without warranty.

8. GOVERNING LAW; JURISDICTION.
   8.1 This Agreement is governed by the laws of the State of Delaware, without regard to its conflict-of-laws principles.
   8.2 The Parties submit to the exclusive jurisdiction of the courts located in New Castle County, Delaware.

9. INJUNCTIVE RELIEF; REMEDIES. Company is entitled to seek injunctive relief for any breach, in addition to all other remedies available.

10. NON-SOLICITATION. For twelve (12) months, Vendor shall not solicit Company employees, except by general solicitations not specifically targeted at Company personnel.

11. ASSIGNMENT.
    11.1 Company may assign this Agreement without consent; Vendor may not assign without Company's prior written consent.

12. MISCELLANEOUS. Notices shall be in writing; this Agreement is the entire agreement; if any provision is unenforceable the remainder stays in effect; amendments must be in writing; and it may be executed in counterparts, each of which is an original and all of which together constitute one instrument.`;

const OFFER_LETTER = `EMPLOYMENT OFFER LETTER

Dear Candidate,

Helio Labs, Inc. (the "Company") is pleased to offer you the position of Senior Engineer, reporting to the VP of Engineering, on the following terms.

1. POSITION AND DUTIES. Full-time, exempt. You agree to devote your full business time and attention to the Company.

2. COMPENSATION. Annual base salary of USD 185,000, paid semi-monthly, plus eligibility for the Company's annual bonus and equity programs.

3. AT-WILL EMPLOYMENT. Your employment is at will and may be terminated by either party at any time, with or without cause or notice.

4. CONFIDENTIALITY AND IP ASSIGNMENT. As a condition of employment you will sign the Company's standard Confidential Information and Invention Assignment Agreement.

5. NON-COMPETITION. You agree not to engage in any competing business for twelve (12) months following termination, anywhere the Company operates.

6. NON-SOLICITATION. For twelve (12) months following termination you shall not solicit the Company's employees or customers.

7. GOVERNING LAW. This letter is governed by the laws of the State of California.

8. ENTIRE AGREEMENT. This letter sets forth the terms of your employment and supersedes all prior discussions.`;

/**
 * Corporate Counsel persona. Primary workflow cluster: NDA review with a fixed
 * house standard (must be mutual, governed by CA or DE, no non-solicit riders;
 * output is just the off-market flags and required edits, not a clause-by-clause
 * table). Two prior NDA-review conversations repeat those preferences verbatim,
 * making the cluster "overdue" for a skill, so a matching preset triggers a cue.
 */
export const lawyerProfile: Profile = {
  id: "lawyer",
  name: "Corporate Counsel",
  role: "Reviews NDAs and commercial contracts against a fixed in-house playbook.",
  blurb:
    "Lives in redlines. Has a consistent, repeated checklist for how NDAs must be reviewed.",
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
        "Review this NDA against our standard: it must be mutual, governed by California or Delaware, and have no non-solicit riders. Don't give me a clause-by-clause table — just flag the off-market clauses and list the required edits.",
      attachmentRefs: ["acme_nda.txt"],
    },
    {
      id: "p_law_2",
      title: "Review a vendor NDA",
      subtitle: "Same playbook, new counterparty",
      prompt:
        "Review this vendor agreement against our standard — mutual, CA or DE governing law, no non-solicit. Skip the clause-by-clause table; just flag the off-market terms and the required edits.",
      attachmentRefs: ["vendor_nda.txt"],
    },
    {
      id: "p_law_3",
      title: "Statute of limitations question",
      subtitle: "One-off question",
      oneOff: true,
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
      oneOff: true,
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
            "Review this NDA against our house standard: it needs to be mutual, governed by California or Delaware, and no non-solicit riders. Don't do a clause-by-clause table — just flag the off-market clauses and the required edits.",
          createdAt: "2026-05-06T14:05:00.000Z",
          attachments: [
            { id: "a1", name: "acme_nda.txt", kind: "text", content: ACME_NDA },
          ],
        },
        {
          id: "m2",
          role: "assistant",
          content:
            "Reviewed against the house standard. **Bottom line: not signable as drafted** — 5 off-market flags.\n\n**Flags**\n- **Not actually mutual** (§3.4): despite the \"Mutual\" caption, obligations run one-way in Acme's favor.\n- **Governing law** (§8): New York, not CA/DE.\n- **Perpetual survival** (§5.2): confidentiality never expires.\n- **Non-solicit rider** (§10): 24-month no-hire + no-divert; we never accept these.\n- **Unrestricted assignment** (§11.1): Acme may assign without consent; counterparty may not.\n\n**Required edits**\n- Strike §3.4 and rewrite §3 so obligations bind each party (genuinely mutual).\n- §8 → Delaware (or California).\n- §5.2 → cap survival at 3–5 years.\n- Delete the §10 non-solicit rider in full.\n- Make §11 mutual and add a consent requirement.\n\nWant me to apply these as a redline?",
          createdAt: "2026-05-06T14:10:00.000Z",
        },
        {
          id: "m3",
          role: "user",
          content: "Yes — redline 3.4, 5.2, 8, 10, and 11, and make the whole thing genuinely mutual.",
          createdAt: "2026-05-06T14:11:00.000Z",
        },
        {
          id: "m4",
          role: "assistant",
          content:
            "Done. Redlines:\n\n- **§3.4** — deleted the one-way carve-out in full and rewrote §3.1–3.3 so the obligations of confidentiality and non-use bind \"each Party as Receiving Party,\" making the agreement genuinely mutual.\n- **§5.2** — replaced \"survive in perpetuity\" with \"survive for three (3) years from the date of disclosure (or, for trade secrets, for so long as the information remains a trade secret).\"\n- **§8** — replaced \"State of New York\" with \"State of Delaware\" in both §8.1 and §8.2, and moved venue to Wilmington, Delaware.\n- **§10** — deleted the non-solicitation rider (§10.1 and §10.2) in its entirety.\n- **§11** — made assignment mutual and added \"with the prior written consent of the other Party (not to be unreasonably withheld), except to a successor in connection with a merger or sale of substantially all assets.\"\n- **§9** — made injunctive relief available to \"the non-breaching Party\" rather than only Acme.\n\nAll five off-market flags resolved and the caption now matches the operative text. I can export the redline as a clean comparison if you want it for the counterparty.",
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
            "Review this vendor NDA against our house standard — it needs to be mutual, governed by Delaware or California, and no non-solicit. No clause-by-clause table; just the off-market flags and required edits.",
          createdAt: "2026-05-21T10:40:00.000Z",
          attachments: [
            { id: "a1", name: "vendor_nda.txt", kind: "text", content: VENDOR_NDA },
          ],
        },
        {
          id: "m2",
          role: "assistant",
          content:
            "Reviewed. **Governing law is Delaware (§8) — that one passes.** Otherwise 3 off-market flags plus an over-long survival.\n\n**Flags**\n- **One-way** (§3.2): only Vendor is bound; Northwind isn't.\n- **Survival 7 years** (§5.2): over our 3–5 year cap.\n- **Non-solicit rider** (§10): 12-month no-hire (general-solicitation carve-out); we don't accept these.\n- **One-sided assignment** (§11): Northwind may assign without consent; Vendor may not.\n\n**Required edits**\n- Make §3.2 mutual.\n- §5.2 → 5 years.\n- Delete the §10 non-solicit rider.\n- Make §11 mutual / add a consent requirement.\n\nWant me to apply these as a redline?",
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
            "Three enforceability problems for a California employer:\n\n- **§5 Non-Compete (12 months, US-wide):** Generally **void and unenforceable** in California under Bus. & Prof. Code § 16600, and newer §§ 16600.1/16600.5 make even *attempting* to enforce a non-compete against a California employee an unlawful act exposing the Company to liability and fees. Recommend striking it entirely.\n- **§6 Non-Solicitation:** The employee no-hire prong is likely unenforceable as to California employees post-*Edwards*; the customer prong is also vulnerable. Recommend narrowing to trade-secret protection only.\n- **§7 Arbitration (jury + class waiver):** Pre-dispute jury waivers are unenforceable in CA outside arbitration; the class/representative waiver needs a PAGA carve-out review post-*Viking River*/*Adolph*.\n\nThe at-will language (§4), salary (§2), and ISO vesting (§3) are standard. Want a redlined version that removes the non-compete, narrows the non-solicit, and revises the arbitration clause?",
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
            "Reviewed the Acme NDA against the house standard; required it be 'mutual', 'governed by California or Delaware', 'no non-solicit riders', and asked to skip the clause-by-clause table and just 'flag the off-market clauses and the required edits'.",
          quotes: [
            "mutual",
            "governed by California or Delaware",
            "no non-solicit riders",
            "flag the off-market clauses",
            "the required edits",
          ],
          cluster: "nda-review",
        },
        {
          conversationId: "c_law_nda2",
          summary:
            "Reviewed the Northwind vendor NDA against the house standard; again specified 'mutual', 'governed by Delaware or California', 'no non-solicit', and asked for just the 'off-market flags and required edits' (no clause-by-clause table).",
          quotes: [
            "mutual",
            "governed by Delaware or California",
            "no non-solicit",
            "off-market flags and required edits",
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
