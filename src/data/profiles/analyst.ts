import type { Profile } from "../../../shared/types.ts";

// ---- Attached CSVs (referenced by presets/conversations by name) ----

const REVENUE_CSV = `product,revenue_musd
Atlas,42.1
Beacon,28.7
Comet,61.4
Delta,15.2
Echo,33.9`;

const MAU_CSV = `month,mau_k
Jan,120
Feb,128
Mar,141
Apr,150
May,162
Jun,171`;

const CHURN_CSV = `segment,churn_pct
Enterprise,2.1
Mid-Market,4.8
SMB,7.9
Self-Serve,11.3`;

const EARNINGS_CSV = `quarter,earnings_musd
Q1,44
Q2,38
Q3,61
Q4,52`;

const GROWTH_CSV = `product,yoy_growth_pct
Atlas,12
Beacon,7
Comet,34
Delta,-3
Echo,21`;

/**
 * Data Analyst persona. Primary workflow cluster: bar charts for decks with a
 * consistent house style (company palette, no gridlines, no legend, sorted).
 * Two prior chart conversations make that cluster "overdue" for a skill, so a
 * matching preset prompt triggers a cue.
 */
export const analystProfile: Profile = {
  id: "analyst",
  name: "Data Analyst",
  role: "Prepares charts and metrics summaries for company decks and reviews.",
  blurb:
    "Lives in spreadsheets and slides. Has strong, repeated opinions about how charts should look.",
  emoji: "📊",

  attachments: [
    { id: "att_rev", name: "revenue_by_product.csv", kind: "csv", content: REVENUE_CSV },
    { id: "att_mau", name: "monthly_active_users.csv", kind: "csv", content: MAU_CSV },
    { id: "att_churn", name: "churn_by_segment.csv", kind: "csv", content: CHURN_CSV },
  ],

  presets: [
    {
      id: "p_an_1",
      title: "Bar chart from a CSV",
      subtitle: "Revenue by product for the board deck",
      prompt:
        "Make a bar chart of revenue by product from this CSV for the board deck. Use our company palette starting with the clay orange #d97757, no gridlines, no legend, and sort the bars descending.",
      attachmentRefs: ["revenue_by_product.csv"],
    },
    {
      id: "p_an_2",
      title: "Churn bar chart",
      subtitle: "By customer segment",
      prompt:
        "Bar chart of churn by segment from this file for our QBR slide — company palette (#d97757 first), no gridlines, no legend, sorted descending.",
      attachmentRefs: ["churn_by_segment.csv"],
    },
    {
      id: "p_an_3",
      title: "Explain a stats concept",
      subtitle: "One-off question",
      prompt: "What's the difference between standard deviation and standard error?",
    },
  ],

  // Shown once the user has an active bar-chart skill — looser, varied asks that
  // lean on it (no style spec, no CSV; the skill supplies the house style).
  loosePresets: [
    {
      id: "p_an_l1",
      title: "Headcount by team",
      subtitle: "Your chart skill styles it",
      prompt:
        "Bar chart of headcount by department: Engineering 48, Sales 22, Marketing 14, Ops 9, Support 17.",
    },
    {
      id: "p_an_l2",
      title: "Revenue by region",
      subtitle: "Your chart skill styles it",
      prompt: "Quick bar chart of Q3 revenue by region: NA 120, EMEA 86, APAC 64, LATAM 31.",
    },
    {
      id: "p_an_l3",
      title: "Pipeline by stage",
      subtitle: "Your chart skill styles it",
      prompt:
        "Chart deals by pipeline stage: Prospect 40, Qualified 25, Proposal 12, Closed 8.",
    },
  ],

  conversations: [
    // --- Cluster: deck-bar-charts (member 1) ---
    {
      id: "c_an_chart1",
      profileId: "analyst",
      title: "Earnings bar chart",
      createdAt: "2026-05-04T15:10:00.000Z",
      updatedAt: "2026-05-04T15:14:00.000Z",
      messages: [
        {
          id: "m1",
          role: "user",
          content:
            "Make a bar chart of quarterly earnings for the deck. Use our company palette (start with the clay orange #d97757), no gridlines, no legend, and sort the bars descending.",
          createdAt: "2026-05-04T15:10:00.000Z",
          attachments: [
            { id: "a_earn", name: "quarterly_earnings.csv", kind: "csv", content: EARNINGS_CSV },
          ],
        },
        {
          id: "m2",
          role: "assistant",
          content:
            "Here's the earnings bar chart in the house style — sorted descending, no gridlines or legend.\n\n```chart\n{\n  \"kind\": \"bar\",\n  \"title\": \"Quarterly Earnings ($M)\",\n  \"data\": [{\"name\":\"Q3\",\"earnings\":61},{\"name\":\"Q4\",\"earnings\":52},{\"name\":\"Q1\",\"earnings\":44},{\"name\":\"Q2\",\"earnings\":38}],\n  \"xKey\": \"name\",\n  \"series\": [\"earnings\"],\n  \"style\": {\"palette\":[\"#d97757\",\"#c2613f\",\"#e0a08a\",\"#8c4a32\"],\"gridlines\":false,\"legend\":false,\"sorted\":true}\n}\n```\n\nWant me to export this to PNG dimensions for slides?",
          createdAt: "2026-05-04T15:12:00.000Z",
        },
      ],
    },
    // --- Cluster: deck-bar-charts (member 2) ---
    {
      id: "c_an_chart2",
      profileId: "analyst",
      title: "Growth across products",
      createdAt: "2026-05-20T09:30:00.000Z",
      updatedAt: "2026-05-20T09:36:00.000Z",
      messages: [
        {
          id: "m1",
          role: "user",
          content:
            "Bar chart of growth across products. Same as always — company colors, no gridlines, no legend, sorted high to low.",
          createdAt: "2026-05-20T09:30:00.000Z",
          attachments: [
            { id: "a_growth", name: "product_growth.csv", kind: "csv", content: GROWTH_CSV },
          ],
        },
        {
          id: "m2",
          role: "assistant",
          content:
            "Done — sorted descending, company palette, no gridlines/legend.\n\n```chart\n{\n  \"kind\": \"bar\",\n  \"title\": \"YoY Growth by Product (%)\",\n  \"data\": [{\"name\":\"Comet\",\"growth\":34},{\"name\":\"Echo\",\"growth\":21},{\"name\":\"Atlas\",\"growth\":12},{\"name\":\"Beacon\",\"growth\":7},{\"name\":\"Delta\",\"growth\":-3}],\n  \"xKey\": \"name\",\n  \"series\": [\"growth\"],\n  \"style\": {\"palette\":[\"#d97757\",\"#c2613f\",\"#e0a08a\",\"#8c4a32\",\"#b4b2a8\"],\"gridlines\":false,\"legend\":false,\"sorted\":true}\n}\n```",
          createdAt: "2026-05-20T09:33:00.000Z",
        },
      ],
    },
    // --- Cluster: weekly-metrics-summary (member 1; not yet repeated) ---
    {
      id: "c_an_summary1",
      profileId: "analyst",
      title: "Weekly metrics summary",
      createdAt: "2026-05-12T17:02:00.000Z",
      updatedAt: "2026-05-12T17:08:00.000Z",
      messages: [
        {
          id: "m1",
          role: "user",
          content:
            "Summarize this MAU CSV into a 3-bullet exec summary: headline number, WoW trend, and one risk. Keep it under 60 words, no fluff.",
          createdAt: "2026-05-12T17:02:00.000Z",
          attachments: [
            { id: "a1", name: "monthly_active_users.csv", kind: "csv", content: MAU_CSV },
          ],
        },
        {
          id: "m2",
          role: "assistant",
          content:
            "• **171K MAU in June**, up 5.6% MoM and +42% since January.\n• Growth is steady but decelerating slightly vs. the Mar–Apr jump.\n• Risk: if the deceleration continues, Q3 lands below the 200K target.",
          createdAt: "2026-05-12T17:05:00.000Z",
        },
      ],
    },
    // --- Spurious / personal Q&A (should NOT cue) ---
    {
      id: "c_an_spur1",
      profileId: "analyst",
      title: "p-values explained",
      createdAt: "2026-05-15T11:00:00.000Z",
      updatedAt: "2026-05-15T11:03:00.000Z",
      messages: [
        {
          id: "m1",
          role: "user",
          content: "Explain what a p-value actually means, simply.",
          createdAt: "2026-05-15T11:00:00.000Z",
        },
        {
          id: "m2",
          role: "assistant",
          content:
            "A p-value is the probability of seeing data at least as extreme as yours if the null hypothesis were true. Small p-value → your result would be surprising under 'nothing's going on,' so you doubt the null. It is *not* the probability the null is true.",
          createdAt: "2026-05-15T11:01:00.000Z",
        },
      ],
    },
    {
      id: "c_an_spur2",
      profileId: "analyst",
      title: "PTO policy",
      createdAt: "2026-05-18T08:20:00.000Z",
      updatedAt: "2026-05-18T08:21:00.000Z",
      messages: [
        {
          id: "m1",
          role: "user",
          content: "How do I calculate how many PTO days I've accrued this year?",
          createdAt: "2026-05-18T08:20:00.000Z",
        },
        {
          id: "m2",
          role: "assistant",
          content:
            "Multiply your monthly accrual rate by months worked, then subtract days already taken. If you accrue 1.5 days/month and it's June (6 months), that's 9 days accrued minus any used.",
          createdAt: "2026-05-18T08:20:30.000Z",
        },
      ],
    },
  ],

  // Pre-extracted offline (see scripts/extract-profiles.ts to regenerate).
  workflowIndex: [
    {
      id: "ws_an_charts",
      cluster: "deck-bar-charts",
      cueStatus: "none",
      updatedAt: "2026-05-20T09:36:00.000Z",
      members: [
        {
          conversationId: "c_an_chart1",
          summary:
            "Created a bar chart of quarterly earnings for a deck; needed the company palette (clay orange #d97757), 'no gridlines', 'no legend', and bars 'sort descending'.",
          quotes: ["company palette", "no gridlines", "no legend", "sort the bars descending"],
          cluster: "deck-bar-charts",
        },
        {
          conversationId: "c_an_chart2",
          summary:
            "Made a bar chart of growth across products; asked for 'company colors', 'no gridlines', 'no legend', 'sorted high to low'.",
          quotes: ["company colors", "no gridlines", "no legend", "sorted high to low"],
          cluster: "deck-bar-charts",
        },
      ],
    },
    {
      id: "ws_an_summary",
      cluster: "weekly-metrics-summary",
      cueStatus: "none",
      updatedAt: "2026-05-12T17:08:00.000Z",
      members: [
        {
          conversationId: "c_an_summary1",
          summary:
            "Summarized a metrics CSV into a 3-bullet exec summary (headline, WoW trend, one risk), 'under 60 words, no fluff'.",
          quotes: ["3-bullet exec summary", "under 60 words", "no fluff"],
          cluster: "weekly-metrics-summary",
        },
      ],
    },
  ],
};
