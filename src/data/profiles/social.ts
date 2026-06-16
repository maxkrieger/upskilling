import type { Profile } from "../../../shared/types.ts";

/**
 * Social Media Manager persona. Promotes artworks for a gallery on Instagram.
 * Primary workflow cluster: Instagram art captions in a consistent house voice
 * (highbrow/sophisticated audience, no em dashes, no grandiose marketing
 * language, followed by a block of relevant hashtags). Two prior caption
 * conversations repeat the same preferences verbatim, making that cluster
 * "overdue" for a skill, so a matching preset prompt triggers a cue.
 */
export const socialProfile: Profile = {
  id: "social",
  name: "Social Media Manager",
  role: "Promotes gallery artworks on Instagram for a sophisticated art audience.",
  blurb:
    "Runs the gallery's Instagram. Cares deeply about tone — no em dashes, no hype — and always wants the right hashtags.",
  emoji: "🖼️",

  attachments: [
    {
      id: "att_art1",
      name: "untitled_no7.jpg",
      kind: "image",
      content: "/data/artwork1.jpg",
    },
    {
      id: "att_art2",
      name: "harbor_light.jpg",
      kind: "image",
      content: "/data/artwork2.jpg",
    },
  ],

  presets: [
    {
      id: "p_so_1",
      title: "Instagram caption for a new work",
      subtitle: "Oil painting, in the house voice",
      prompt:
        "Write an Instagram caption for a new work. Artist: Mara Velasco. Title: 'Untitled No. 7'. Medium: oil on linen. Year: 2025. Themes: memory, erosion, domestic interiors. Highbrow audience, no em dashes, no grandiosity, and add hashtags.",
      attachmentRefs: ["untitled_no7.jpg"],
    },
    {
      id: "p_so_2",
      title: "Exhibition announcement",
      subtitle: "Opening night post",
      prompt:
        "Draft an Instagram exhibition announcement for our show 'Quiet Tide', a group exhibition of three coastal painters, opening Friday June 27 at 6pm, on view through August 9.",
    },
    {
      id: "p_so_3",
      title: "Best time to post",
      subtitle: "One-off question",
      prompt: "What time of day should a gallery post on Instagram to get the most engagement?",
    },
  ],

  // Shown once the user has an active caption skill — just the artwork facts;
  // the skill supplies the highbrow voice, no-em-dash rule, and hashtags.
  loosePresets: [
    {
      id: "p_so_l1",
      title: "Caption: cyanotype",
      subtitle: "Your caption skill applies the voice",
      prompt:
        "Caption for a new piece. Artist: Tomás Rivera. Title: 'Saltmarsh'. Medium: cyanotype on cotton. Year: 2024. Themes: tide, memory.",
    },
    {
      id: "p_so_l2",
      title: "Caption: bronze",
      subtitle: "Your caption skill applies the voice",
      prompt:
        "Caption for a new sculpture. Artist: Lena Brandt. Title: 'Aftering'. Medium: cast bronze. Year: 2023. Themes: the persistence of form.",
    },
    {
      id: "p_so_l3",
      title: "Best time to post",
      subtitle: "One-off question",
      prompt: "What time of day should a gallery post on Instagram to get the most engagement?",
    },
  ],

  conversations: [
    // --- Cluster: instagram-art-caption (member 1) ---
    {
      id: "c_so_cap1",
      profileId: "social",
      title: "Caption: Etchings, R. Okafor",
      createdAt: "2026-05-06T13:40:00.000Z",
      updatedAt: "2026-05-06T13:45:00.000Z",
      messages: [
        {
          id: "m1",
          role: "user",
          content:
            "Write an Instagram caption for a new piece. Artist: Rotimi Okafor. Title: 'Threshold II'. Medium: copperplate etching. Year: 2024. Themes: migration, thresholds, the body in transit. Write for a highbrow audience, no em dashes, no grandiosity, and add hashtags.",
          createdAt: "2026-05-06T13:40:00.000Z",
        },
        {
          id: "m2",
          role: "assistant",
          content:
            "Rotimi Okafor, *Threshold II* (2024), copperplate etching.\n\nA figure pauses at the edge of a doorway, neither arriving nor leaving. Okafor works the copperplate in close, deliberate lines, letting the bitten marks hold the weight of the body in transit. The etching reads as a study of thresholds: the moments of crossing that migration asks us to repeat.\n\nOn view now at the gallery.\n\n#RotimiOkafor #copperplateetching #printmaking #contemporaryprint #figurativeart #migrationart #worksonpaper #fineartprint #galleryexhibition #intaglio",
          createdAt: "2026-05-06T13:43:00.000Z",
        },
        {
          id: "m3",
          role: "user",
          content: "Perfect, that's the voice. Thanks.",
          createdAt: "2026-05-06T13:44:00.000Z",
        },
        {
          id: "m4",
          role: "assistant",
          content:
            "Glad it lands. Send the next artwork's details whenever you're ready and I'll keep to the same tone.",
          createdAt: "2026-05-06T13:45:00.000Z",
        },
      ],
    },
    // --- Cluster: instagram-art-caption (member 2) ---
    {
      id: "c_so_cap2",
      profileId: "social",
      title: "Caption: Sculpture, L. Brandt",
      createdAt: "2026-05-22T10:15:00.000Z",
      updatedAt: "2026-05-22T10:19:00.000Z",
      messages: [
        {
          id: "m1",
          role: "user",
          content:
            "Caption for our new arrival, same as last time. Artist: Lena Brandt. Title: 'Ballast'. Medium: cast bronze. Year: 2023. Themes: weight, equilibrium, labor. Highbrow audience, no em dashes, no grandiosity, and add hashtags.",
          createdAt: "2026-05-22T10:15:00.000Z",
        },
        {
          id: "m2",
          role: "assistant",
          content:
            "Lena Brandt, *Ballast* (2023), cast bronze.\n\nBrandt sets two uneven masses against each other and asks them to hold still. The bronze keeps the memory of the pour in its surface, a record of labor that the finished form never quite hides. *Ballast* is about the quiet arithmetic of weight, and what it costs to stay balanced.\n\nNow on view in the main room.\n\n#LenaBrandt #castbronze #contemporarysculpture #bronzesculpture #sculptureart #fineart #galleryexhibition #abstractsculpture #artcollector #sculptureoftheday",
          createdAt: "2026-05-22T10:18:00.000Z",
        },
      ],
    },
    // --- Cluster: exhibition-announcement (member 1; not yet repeated) ---
    {
      id: "c_so_show1",
      profileId: "social",
      title: "Announcement: 'After Rain'",
      createdAt: "2026-05-14T16:05:00.000Z",
      updatedAt: "2026-05-14T16:10:00.000Z",
      messages: [
        {
          id: "m1",
          role: "user",
          content:
            "Write an Instagram announcement for our new show 'After Rain', a solo exhibition of paintings by Yuki Sato, opening Thursday May 29 at 6pm, on view through July 12. Highbrow audience, no em dashes, no grandiosity, add hashtags.",
          createdAt: "2026-05-14T16:05:00.000Z",
        },
        {
          id: "m2",
          role: "assistant",
          content:
            "*After Rain*: new paintings by Yuki Sato.\n\nSato paints the hour after a storm, when the light is uncertain and surfaces are still holding water. The works move between landscape and abstraction, attentive to the way color settles once the air has cleared.\n\nOpening reception Thursday, May 29, 6pm. On view through July 12.\n\n#YukiSato #AfterRain #contemporarypainting #soloexhibition #landscapepainting #galleryopening #fineart #artexhibition #paintingsofinstagram #artopening",
          createdAt: "2026-05-14T16:08:00.000Z",
        },
      ],
    },
    // --- Spurious / personal Q&A (should NOT cue) ---
    {
      id: "c_so_spur1",
      profileId: "social",
      title: "Best time to post",
      createdAt: "2026-05-17T09:30:00.000Z",
      updatedAt: "2026-05-17T09:32:00.000Z",
      messages: [
        {
          id: "m1",
          role: "user",
          content: "What time of day should a gallery post on Instagram to get the most engagement?",
          createdAt: "2026-05-17T09:30:00.000Z",
        },
        {
          id: "m2",
          role: "assistant",
          content:
            "For arts and culture accounts, weekday late mornings (around 11am) and early evenings (6 to 8pm) tend to perform best, since people check in during commutes and after work. Weekends skew later. The honest answer is to check your own Insights tab for when your followers are actually online, then test a couple of slots for two weeks and compare.",
          createdAt: "2026-05-17T09:31:00.000Z",
        },
      ],
    },
    {
      id: "c_so_spur2",
      profileId: "social",
      title: "Houseplant help",
      createdAt: "2026-05-19T19:45:00.000Z",
      updatedAt: "2026-05-19T19:46:00.000Z",
      messages: [
        {
          id: "m1",
          role: "user",
          content: "My fiddle leaf fig keeps dropping leaves. What am I doing wrong?",
          createdAt: "2026-05-19T19:45:00.000Z",
        },
        {
          id: "m2",
          role: "assistant",
          content:
            "Fiddle leaf figs drop leaves mostly from inconsistent watering and being moved. Let the top couple inches of soil dry out before watering, keep it in bright indirect light, and avoid relocating it. Sudden leaf drop is usually a stress response to a change in conditions rather than something you did all at once.",
          createdAt: "2026-05-19T19:46:00.000Z",
        },
      ],
    },
  ],

  // Pre-extracted offline (see scripts/extract-profiles.ts to regenerate).
  workflowIndex: [
    {
      id: "ws_so_caption",
      cluster: "instagram-art-caption",
      cueStatus: "none",
      updatedAt: "2026-05-22T10:19:00.000Z",
      members: [
        {
          conversationId: "c_so_cap1",
          summary:
            "Wrote an Instagram caption for an etching by Rotimi Okafor; wanted a 'highbrow audience', 'no em dashes', 'no grandiosity', and to 'add hashtags'.",
          quotes: ["highbrow audience", "no em dashes", "no grandiosity", "add hashtags"],
          cluster: "instagram-art-caption",
        },
        {
          conversationId: "c_so_cap2",
          summary:
            "Wrote an Instagram caption for a Lena Brandt bronze 'same as last time'; asked for a 'highbrow audience', 'no em dashes', 'no grandiosity', and to 'add hashtags'.",
          quotes: ["highbrow audience", "no em dashes", "no grandiosity", "add hashtags"],
          cluster: "instagram-art-caption",
        },
      ],
    },
    {
      id: "ws_so_announce",
      cluster: "exhibition-announcement",
      cueStatus: "none",
      updatedAt: "2026-05-14T16:10:00.000Z",
      members: [
        {
          conversationId: "c_so_show1",
          summary:
            "Drafted an Instagram exhibition announcement for the solo show 'After Rain' (opening date, on-view dates); wanted a 'highbrow audience', 'no em dashes', 'no grandiosity', 'add hashtags'.",
          quotes: ["highbrow audience", "no em dashes", "no grandiosity", "add hashtags"],
          cluster: "exhibition-announcement",
        },
      ],
    },
  ],
};
