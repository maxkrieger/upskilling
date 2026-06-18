import type { Profile } from "../../../shared/types.ts";

/**
 * Social Media Manager persona. Promotes artworks for a gallery on Instagram.
 * Primary workflow cluster: Instagram art captions in a consistent house voice
 * (sophisticated audience, no em dashes, no grandiose marketing
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
        "Write an Instagram caption for a new work. Artist: Mara Velasco. Title: 'Untitled No. 7'. Medium: oil on linen. Year: 2025. Themes: memory, erosion, domestic interiors. Sophisticated audience, no em dashes, no grandiosity, and add hashtags.",
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
      oneOff: true,
      prompt: "What time of day should a gallery post on Instagram to get the most engagement?",
    },
  ],

  // Shown once the user has an active caption skill — just the artwork facts;
  // the skill supplies the sophisticated voice, no-em-dash rule, and hashtags.
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
      oneOff: true,
      prompt: "What time of day should a gallery post on Instagram to get the most engagement?",
    },
  ],

  conversations: [
    // --- Cluster: instagram-art-caption (member 1) — the FIRST time, the house
    //     voice is established through a couple of corrections (kill the em dash
    //     and grandiosity, keep it sophisticated, then add hashtags). Members 2 and 3
    //     below are the terse "same voice as always" repeats. ---
    {
      id: "c_so_cap1",
      profileId: "social",
      title: "Caption: Etchings, R. Okafor",
      createdAt: "2026-05-06T13:40:00.000Z",
      updatedAt: "2026-05-06T13:49:00.000Z",
      messages: [
        {
          id: "m1",
          role: "user",
          content:
            "Write an Instagram caption for a new piece. Artist: Rotimi Okafor. Title: 'Threshold II'. Medium: copperplate etching. Year: 2024. Themes: migration, thresholds, the body in transit.",
          createdAt: "2026-05-06T13:40:00.000Z",
        },
        {
          id: "m2",
          role: "assistant",
          content:
            "Rotimi Okafor, *Threshold II* (2024) — a breathtaking, unmissable meditation on migration that will stop you mid-scroll. A lone figure hovers in a doorway, caught in a transformative moment of profound transit. An absolute must-see masterpiece you cannot afford to miss.",
          createdAt: "2026-05-06T13:42:00.000Z",
        },
        {
          id: "m3",
          role: "user",
          content:
            "Too much. For our house voice: no em dashes, and lose the grandiosity — keep it understated for a sophisticated audience.",
          createdAt: "2026-05-06T13:44:00.000Z",
        },
        {
          id: "m4",
          role: "assistant",
          content:
            "Rotimi Okafor, *Threshold II* (2024), copperplate etching.\n\nA figure pauses at the edge of a doorway, neither arriving nor leaving. Okafor works the copperplate in close, deliberate lines, letting the bitten marks hold the weight of the body in transit. The etching reads as a study of thresholds: the moments of crossing that migration asks us to repeat.\n\nOn view now at the gallery.",
          createdAt: "2026-05-06T13:45:00.000Z",
        },
        {
          id: "m5",
          role: "user",
          content: "Better. Now add a block of relevant hashtags.",
          createdAt: "2026-05-06T13:47:00.000Z",
        },
        {
          id: "m6",
          role: "assistant",
          content:
            "Rotimi Okafor, *Threshold II* (2024), copperplate etching.\n\nA figure pauses at the edge of a doorway, neither arriving nor leaving. Okafor works the copperplate in close, deliberate lines, letting the bitten marks hold the weight of the body in transit. The etching reads as a study of thresholds: the moments of crossing that migration asks us to repeat.\n\nOn view now at the gallery.\n\n#RotimiOkafor #copperplateetching #printmaking #contemporaryprint #figurativeart #migrationart #worksonpaper #fineartprint #galleryexhibition #intaglio",
          createdAt: "2026-05-06T13:48:00.000Z",
        },
        {
          id: "m7",
          role: "user",
          content: "Perfect, that's the voice.",
          createdAt: "2026-05-06T13:49:00.000Z",
        },
        {
          id: "m8",
          role: "assistant",
          content:
            "Glad it lands. Send the next artwork's details whenever you're ready and I'll keep to the same register.",
          createdAt: "2026-05-06T13:49:30.000Z",
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
            "Caption for our new arrival, same as last time. Artist: Lena Brandt. Title: 'Ballast'. Medium: cast bronze. Year: 2023. Themes: weight, equilibrium, labor. Sophisticated audience, no em dashes, no grandiosity, and add hashtags.",
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
    // --- Cluster: instagram-art-caption (member 3; photograph) ---
    {
      id: "c_so_cap3",
      profileId: "social",
      title: "Caption: Photograph, A. Nwosu",
      createdAt: "2026-05-28T11:20:00.000Z",
      updatedAt: "2026-05-28T11:24:00.000Z",
      messages: [
        {
          id: "m1",
          role: "user",
          content:
            "Another caption please, same voice as always. Artist: Adaeze Nwosu. Title: 'Low Season'. Medium: archival pigment print. Year: 2025. Themes: emptied resort towns, the off-season, absence. Sophisticated audience, no em dashes, no grandiosity, and add hashtags.",
          createdAt: "2026-05-28T11:20:00.000Z",
        },
        {
          id: "m2",
          role: "assistant",
          content:
            "Adaeze Nwosu, *Low Season* (2025), archival pigment print.\n\nNwosu photographs a coastal town after the visitors have gone. A shuttered kiosk, a row of stacked chairs, a pool drained for the winter. The frame is patient with what is missing, and finds in the off-season a kind of composure that the crowds never allow. The color stays cool and even, closer to record than to mood.\n\nOn view now in the project space.\n\n#AdaezeNwosu #archivalpigmentprint #contemporaryphotography #fineartphotography #photography #colorphotography #galleryexhibition #photographyart #worksonpaper #photooftheday",
          createdAt: "2026-05-28T11:23:00.000Z",
        },
        {
          id: "m3",
          role: "user",
          content: "Lovely, exactly right.",
          createdAt: "2026-05-28T11:24:00.000Z",
        },
      ],
    },
    // --- Cluster: artist-spotlight (member 1; studio visit, not yet repeated) ---
    {
      id: "c_so_spot1",
      profileId: "social",
      title: "Studio visit: T. Rivera",
      createdAt: "2026-05-30T15:10:00.000Z",
      updatedAt: "2026-05-30T15:15:00.000Z",
      messages: [
        {
          id: "m1",
          role: "user",
          content:
            "Write a short studio-visit / artist-spotlight Instagram post. Artist: Tomás Rivera. Medium: cyanotype on cotton. Working on a series called 'Saltmarsh' about tidal flats near where he grew up. He exposes the cloth outdoors at dawn and lets the fog affect the print. Sophisticated audience, no em dashes, no grandiosity, and add hashtags.",
          createdAt: "2026-05-30T15:10:00.000Z",
        },
        {
          id: "m2",
          role: "assistant",
          content:
            "Studio visit: Tomás Rivera.\n\nRivera makes his cyanotypes outdoors, laying treated cotton across the ground at dawn and letting the morning do part of the work. For the *Saltmarsh* series he returns to the tidal flats he grew up near, where the fog rolls in and softens the exposure in ways he cannot fully plan. What comes back is a record of a particular hour and a particular weather, fixed in Prussian blue. We spent the morning watching the cloth change as the light came up.\n\nMore from the series soon.\n\n#TomasRivera #cyanotype #alternativeprocess #studiovisit #contemporaryart #textileart #worksoncloth #bluework #artiststudio #fineart",
          createdAt: "2026-05-30T15:14:00.000Z",
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
            "Write an Instagram announcement for our new show 'After Rain', a solo exhibition of paintings by Yuki Sato, opening Thursday May 29 at 6pm, on view through July 12. Sophisticated audience, no em dashes, no grandiosity, add hashtags.",
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
      updatedAt: "2026-05-28T11:24:00.000Z",
      members: [
        {
          conversationId: "c_so_cap1",
          summary:
            "Wrote an Instagram caption for a Rotimi Okafor etching, settling the house voice through a couple of corrections: 'no em dashes', 'lose the grandiosity', keep it understated for a 'sophisticated audience', then 'add a block of relevant hashtags'.",
          quotes: [
            "no em dashes",
            "lose the grandiosity",
            "sophisticated audience",
            "add a block of relevant hashtags",
          ],
          cluster: "instagram-art-caption",
        },
        {
          conversationId: "c_so_cap2",
          summary:
            "Wrote an Instagram caption for a Lena Brandt bronze 'same as last time'; asked for a 'sophisticated audience', 'no em dashes', 'no grandiosity', and to 'add hashtags'.",
          quotes: ["sophisticated audience", "no em dashes", "no grandiosity", "add hashtags"],
          cluster: "instagram-art-caption",
        },
        {
          conversationId: "c_so_cap3",
          summary:
            "Wrote an Instagram caption for an Adaeze Nwosu photograph 'same voice as always'; asked for a 'sophisticated audience', 'no em dashes', 'no grandiosity', and to 'add hashtags'.",
          quotes: ["sophisticated audience", "no em dashes", "no grandiosity", "add hashtags"],
          cluster: "instagram-art-caption",
        },
      ],
    },
    {
      id: "ws_so_spotlight",
      cluster: "artist-spotlight",
      cueStatus: "none",
      updatedAt: "2026-05-30T15:15:00.000Z",
      members: [
        {
          conversationId: "c_so_spot1",
          summary:
            "Wrote a studio-visit / artist-spotlight post for Tomás Rivera's cyanotype 'Saltmarsh' series; wanted a 'sophisticated audience', 'no em dashes', 'no grandiosity', and to 'add hashtags'.",
          quotes: ["sophisticated audience", "no em dashes", "no grandiosity", "add hashtags"],
          cluster: "artist-spotlight",
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
            "Drafted an Instagram exhibition announcement for the solo show 'After Rain' (opening date, on-view dates); wanted a 'sophisticated audience', 'no em dashes', 'no grandiosity', 'add hashtags'.",
          quotes: ["sophisticated audience", "no em dashes", "no grandiosity", "add hashtags"],
          cluster: "exhibition-announcement",
        },
      ],
    },
  ],
};
