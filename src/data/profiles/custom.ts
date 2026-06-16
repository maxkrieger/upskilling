import type { Profile } from "../../../shared/types.ts";

/**
 * A blank profile with no seeded history. Workflows and Skills build up
 * organically as the user chats — once a workflow repeats, cueing kicks in.
 */
export const customProfile: Profile = {
  id: "custom",
  name: "Custom",
  role: "A blank profile — start fresh and let your own workflows and Skills build up.",
  blurb: "A clean slate. Chat freely; as your requests repeat, Skills will surface.",
  emoji: "✨",
  presets: [],
  attachments: [],
  conversations: [],
  workflowIndex: [],
};
