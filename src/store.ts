import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Attachment,
  ChatMeta,
  Conversation,
  Message,
  Skill,
  WorkflowSet,
  WorkflowSummary,
} from "../shared/types.ts";
import { BUILTIN_SKILLS, getProfile, PROFILES } from "./data/index.ts";
import {
  deleteSkillRemote,
  extractWorkflow,
  registerSkillRemote,
  streamChat,
  streamCreateSkill,
} from "./api.ts";

const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 10)}`;
const now = () => new Date().toISOString();

export type View = "chat" | "customize";

interface State {
  authed: boolean;
  activeProfileId: string;
  activeConversationId: string | null;
  view: View;
  sending: boolean;
  /** Attachment open in the side viewer panel (null = closed). */
  viewerAttachment: Attachment | null;

  /** User-created (or promoted) conversations, keyed by profile id. */
  userConversations: Record<string, Conversation[]>;
  /** Workflow index overrides, keyed by profile id (seed when absent). */
  indexOverrides: Record<string, WorkflowSet[]>;
  /** Skills per profile (builtin + user-created); each profile has its own set. */
  skillsByProfile: Record<string, Skill[]>;
  /** Epoch ms until which skill cues are snoozed (null = not snoozed). */
  cuesSnoozedUntil: number | null;

  // selectors
  conversations: (profileId?: string) => Conversation[];
  index: (profileId?: string) => WorkflowSet[];
  skillsOf: (profileId?: string) => Skill[];
  activeConversation: () => Conversation | undefined;

  // actions
  login: (ok: boolean) => void;
  setProfile: (id: string) => void;
  setView: (v: View) => void;
  openConversation: (id: string | null) => void;
  newConversation: () => void;
  sendMessage: (text: string, attachments?: Attachment[]) => Promise<void>;
  acceptCue: (conversationId: string, messageId: string) => Promise<void>;
  dismissCue: (conversationId: string, messageId: string) => void;
  snoozeCue: (conversationId: string, messageId: string) => void;
  toggleSkill: (id: string) => void;
  deleteSkill: (id: string) => void;
  addManualSkill: (name: string, description: string, instructions: string) => Promise<void>;
  clearAllData: () => void;
  openAttachment: (a: Attachment) => void;
  closeAttachment: () => void;
}

function mergeConversations(profileId: string, userConvos: Conversation[]): Conversation[] {
  const seeded = getProfile(profileId)?.conversations ?? [];
  const userIds = new Set(userConvos.map((c) => c.id));
  const merged = [...userConvos, ...seeded.filter((c) => !userIds.has(c.id))];
  return merged.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      authed: false,
      activeProfileId: PROFILES[0].id,
      activeConversationId: null,
      view: "chat",
      sending: false,
      viewerAttachment: null,
      userConversations: {},
      indexOverrides: {},
      skillsByProfile: Object.fromEntries(PROFILES.map((p) => [p.id, BUILTIN_SKILLS])),
      cuesSnoozedUntil: null,

      conversations: (profileId) =>
        mergeConversations(
          profileId ?? get().activeProfileId,
          get().userConversations[profileId ?? get().activeProfileId] ?? [],
        ),

      index: (profileId) => {
        const pid = profileId ?? get().activeProfileId;
        return get().indexOverrides[pid] ?? getProfile(pid)?.workflowIndex ?? [];
      },

      skillsOf: (profileId) => {
        const pid = profileId ?? get().activeProfileId;
        return get().skillsByProfile[pid] ?? BUILTIN_SKILLS;
      },

      activeConversation: () => {
        const { activeConversationId } = get();
        if (!activeConversationId) return undefined;
        return get().conversations().find((c) => c.id === activeConversationId);
      },

      login: (ok) => set({ authed: ok }),

      setProfile: (id) =>
        set({ activeProfileId: id, activeConversationId: null, view: "chat" }),

      setView: (v) => set({ view: v }),

      openConversation: (id) => set({ activeConversationId: id, view: "chat" }),

      newConversation: () => set({ activeConversationId: null, view: "chat" }),

      // ---- Sending a message (creates/promotes a user conversation) ----
      sendMessage: async (text, attachments) => {
        const state = get();
        const profile = getProfile(state.activeProfileId);
        if (!profile || state.sending) return;

        // Resolve or create the active conversation in userConversations.
        const pid = profile.id;
        const userConvos = [...(state.userConversations[pid] ?? [])];
        let convo = state.activeConversation();

        if (!convo) {
          convo = {
            id: uid("conv"),
            profileId: pid,
            title: text.slice(0, 48) || "New chat",
            messages: [],
            createdAt: now(),
            updatedAt: now(),
            userCreated: true,
          };
          userConvos.unshift(convo);
        } else if (!userConvos.find((c) => c.id === convo!.id)) {
          // Promote a seeded conversation into the editable user store.
          convo = { ...convo, messages: [...convo.messages], userCreated: true };
          userConvos.unshift(convo);
        } else {
          convo = userConvos.find((c) => c.id === convo!.id)!;
        }

        const userMsg: Message = {
          id: uid("m"),
          role: "user",
          content: text,
          attachments,
          createdAt: now(),
        };
        const assistantMsg: Message = {
          id: uid("m"),
          role: "assistant",
          content: "",
          createdAt: now(),
        };
        convo.messages = [...convo.messages, userMsg, assistantMsg];
        convo.updatedAt = now();

        const writeConvos = (mutator: (c: Conversation) => void) => {
          set((s) => {
            const list = [...(s.userConversations[pid] ?? [])];
            const idx = list.findIndex((c) => c.id === convo!.id);
            if (idx === -1) return s;
            const copy = { ...list[idx], messages: [...list[idx].messages] };
            mutator(copy);
            list[idx] = copy;
            return { userConversations: { ...s.userConversations, [pid]: list } };
          });
        };

        set({
          sending: true,
          activeConversationId: convo.id,
          userConversations: { ...state.userConversations, [pid]: userConvos },
        });

        const enabledSkills = get().skillsOf(pid).filter((s) => s.enabled);
        const history = convo.messages
          .filter((m) => m.id !== assistantMsg.id)
          .map((m) => ({ role: m.role, content: m.content, attachments: m.attachments }));
        // Held back and attached only after the reply finishes streaming, so the
        // cue banner reads as an inline follow-up to a complete response.
        let pendingBanner: ChatMeta["banner"] | undefined;

        await streamChat(
          {
            profileId: pid,
            profileName: profile.name,
            profileRole: profile.role,
            messages: history,
            skills: enabledSkills,
            workflowIndex: get().index(pid),
            suppressCue: (get().cuesSnoozedUntil ?? 0) > Date.now(),
          },
          {
            onMeta: (meta: ChatMeta) => {
              pendingBanner = meta.banner; // shown after the reply streams in
              writeConvos((c) => {
                const am = c.messages.find((m) => m.id === assistantMsg.id);
                if (am) am.appliedSkillIds = meta.appliedSkillIds;
              });
            },
            onDelta: (delta) => {
              writeConvos((c) => {
                const am = c.messages.find((m) => m.id === assistantMsg.id);
                if (am) am.content += delta;
              });
            },
            onError: (msg) => {
              writeConvos((c) => {
                const am = c.messages.find((m) => m.id === assistantMsg.id);
                if (am) am.content += `\n\n_⚠️ ${msg}_`;
              });
            },
          },
        );

        // Attach the cue banner now that the full reply has streamed in.
        if (pendingBanner) {
          writeConvos((c) => {
            const am = c.messages.find((m) => m.id === assistantMsg.id);
            if (am) am.banner = pendingBanner;
          });
        }

        set({ sending: false });
        // Re-extract this conversation's workflow summary (overwrite on each turn).
        void refreshIndexForConversation(get, set, pid, convo.id);
      },

      // ---- Accept a cue: invoke the skill-creator as an interactive,
      // streamed chat turn, then register the resulting skill. ----
      acceptCue: async (conversationId, messageId) => {
        const pid = get().activeProfileId;
        const convo = get().conversations(pid).find((c) => c.id === conversationId);
        const msg = convo?.messages.find((m) => m.id === messageId);
        const banner = msg?.banner;
        if (!banner || get().sending) return;

        const wfSet = get().index(pid).find((s) => s.id === banner.workflowSetId);
        if (!wfSet) return;

        const memberConvos = get()
          .conversations(pid)
          .filter((c) => wfSet.members.some((m) => m.conversationId === c.id));

        // Append an interactive turn: the user's "create a skill" request and a
        // streaming assistant reply from the skill-creator.
        const assistantId = uid("m");
        const turn: Message[] = [
          {
            id: uid("m"),
            role: "user",
            content: `Create a Skill for my ${wfSet.cluster.replace(/-/g, " ")} workflow.`,
            createdAt: now(),
          },
          { id: assistantId, role: "assistant", content: "", createdAt: now() },
        ];

        const writeAssistant = (mutate: (m: Message) => void) => {
          set((s) => {
            const list = [...(s.userConversations[pid] ?? [])];
            const ci = list.findIndex((c) => c.id === conversationId);
            if (ci === -1) return s;
            const c2 = { ...list[ci], messages: [...list[ci].messages] };
            const mi = c2.messages.findIndex((m) => m.id === assistantId);
            if (mi === -1) return s;
            c2.messages[mi] = { ...c2.messages[mi] };
            mutate(c2.messages[mi]);
            c2.updatedAt = now();
            list[ci] = c2;
            return { userConversations: { ...s.userConversations, [pid]: list } };
          });
        };

        set((s) => {
          const list = [...(s.userConversations[pid] ?? [])];
          const ci = list.findIndex((c) => c.id === conversationId);
          if (ci === -1) return s;
          const c2 = { ...list[ci], messages: [...list[ci].messages, ...turn], updatedAt: now() };
          list[ci] = c2;
          return { sending: true, userConversations: { ...s.userConversations, [pid]: list } };
        });

        await streamCreateSkill(
          { workflowSet: wfSet, conversations: memberConvos },
          {
            onDelta: (delta) => writeAssistant((m) => (m.content += delta)),
            onSkill: (skill) => {
              set((s) => ({
                skillsByProfile: {
                  ...s.skillsByProfile,
                  [pid]: [...(s.skillsByProfile[pid] ?? BUILTIN_SKILLS), skill],
                },
              }));
              writeAssistant((m) => (m.appliedSkillIds = [skill.id]));
              updateIndexSet(get, set, pid, wfSet.id, (ws) => {
                ws.cueStatus = "accepted";
                ws.skillId = skill.id;
              });
              // Flip the original cue banner to its "created" state.
              updateMessageBanner(set, pid, conversationId, messageId, { status: "accepted" });
            },
            onError: (errMsg) =>
              writeAssistant((m) => (m.content += `\n\n_⚠️ ${errMsg}_`)),
          },
        );

        set({ sending: false });
      },

      dismissCue: (conversationId, messageId) => {
        const pid = get().activeProfileId;
        const convo = get().conversations(pid).find((c) => c.id === conversationId);
        const banner = convo?.messages.find((m) => m.id === messageId)?.banner;
        updateMessageBanner(set, pid, conversationId, messageId, { status: "dismissed" });
        if (banner) {
          updateIndexSet(get, set, pid, banner.workflowSetId, (ws) => {
            ws.cueStatus = "rejected";
          });
        }
      },

      // Snooze: hide this cue and suppress all cues for a while, WITHOUT
      // permanently rejecting the workflow set (it can cue again later).
      snoozeCue: (conversationId, messageId) => {
        const pid = get().activeProfileId;
        updateMessageBanner(set, pid, conversationId, messageId, { status: "snoozed" });
        set({ cuesSnoozedUntil: Date.now() + 60 * 60 * 1000 }); // 1 hour
      },

      toggleSkill: (id) => {
        const pid = get().activeProfileId;
        set((s) => ({
          skillsByProfile: {
            ...s.skillsByProfile,
            [pid]: (s.skillsByProfile[pid] ?? BUILTIN_SKILLS).map((sk) =>
              sk.id === id ? { ...sk, enabled: !sk.enabled } : sk,
            ),
          },
        }));
      },

      deleteSkill: (id) => {
        const pid = get().activeProfileId;
        const sk = get().skillsOf(pid).find((x) => x.id === id);
        if (sk?.source === "builtin") return;
        // Best-effort: also delete it from the official Skills API.
        if (sk?.skillId) void deleteSkillRemote(sk.skillId);
        set((s) => ({
          skillsByProfile: {
            ...s.skillsByProfile,
            [pid]: (s.skillsByProfile[pid] ?? BUILTIN_SKILLS).filter((x) => x.id !== id),
          },
        }));
      },

      addManualSkill: async (name, description, instructions) => {
        const pid = get().activeProfileId;
        const skillLocalId = uid("skill");
        const patch = (mut: (list: Skill[]) => Skill[]) =>
          set((s) => ({
            skillsByProfile: {
              ...s.skillsByProfile,
              [pid]: mut(s.skillsByProfile[pid] ?? BUILTIN_SKILLS),
            },
          }));
        patch((list) => [
          ...list,
          {
            id: skillLocalId,
            name,
            description,
            instructions,
            source: "user",
            enabled: true,
            createdAt: now(),
          },
        ]);
        // Register with the official Skills API so the model can load it.
        const registered = await registerSkillRemote({ name, description, instructions });
        if (registered) {
          patch((list) =>
            list.map((sk) =>
              sk.id === skillLocalId
                ? { ...sk, skillId: registered.skillId, skillVersion: registered.skillVersion }
                : sk,
            ),
          );
        }
      },

      openAttachment: (a) => set({ viewerAttachment: a }),
      closeAttachment: () => set({ viewerAttachment: null }),

      // Wipe all persisted state (skills, conversations, workflow index, auth)
      // and reload to a clean first-run.
      clearAllData: () => {
        try {
          localStorage.clear();
        } catch {
          /* ignore */
        }
        window.location.reload();
      },
    }),
    {
      name: "upskilling-state",
      partialize: (s) => ({
        authed: s.authed,
        activeProfileId: s.activeProfileId,
        userConversations: s.userConversations,
        indexOverrides: s.indexOverrides,
        skillsByProfile: s.skillsByProfile,
        cuesSnoozedUntil: s.cuesSnoozedUntil,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        // Ensure every profile has its own skill set with the builtins present.
        const byProfile = { ...current.skillsByProfile, ...(p.skillsByProfile ?? {}) };
        for (const prof of PROFILES) {
          const list = byProfile[prof.id] ?? [];
          byProfile[prof.id] = [
            ...BUILTIN_SKILLS.filter((b) => !list.some((s) => s.id === b.id)),
            ...list,
          ];
        }
        return { ...current, ...p, skillsByProfile: byProfile };
      },
    },
  ),
);

// ---- helpers operating on the store ----

type Get = () => State;
type Set = (partial: Partial<State> | ((s: State) => Partial<State>)) => void;

function updateMessageBanner(
  set: Set,
  pid: string,
  conversationId: string,
  messageId: string,
  patch: Partial<NonNullable<Message["banner"]>>,
) {
  set((s) => {
    const list = [...(s.userConversations[pid] ?? [])];
    const ci = list.findIndex((c) => c.id === conversationId);
    if (ci === -1) return s;
    const convo = { ...list[ci], messages: [...list[ci].messages] };
    const mi = convo.messages.findIndex((m) => m.id === messageId);
    if (mi === -1 || !convo.messages[mi].banner) return s;
    convo.messages[mi] = {
      ...convo.messages[mi],
      banner: { ...convo.messages[mi].banner!, ...patch },
    };
    list[ci] = convo;
    return { userConversations: { ...s.userConversations, [pid]: list } };
  });
}

function getIndexBase(get: Get, pid: string): WorkflowSet[] {
  return (
    get().indexOverrides[pid] ??
    (getProfile(pid)?.workflowIndex ?? []).map((s) => ({ ...s, members: [...s.members] }))
  );
}

function updateIndexSet(
  get: Get,
  set: Set,
  pid: string,
  setId: string,
  mutator: (ws: WorkflowSet) => void,
) {
  const base = getIndexBase(get, pid).map((s) => ({ ...s, members: [...s.members] }));
  const target = base.find((s) => s.id === setId);
  if (target) mutator(target);
  set((s) => ({ indexOverrides: { ...s.indexOverrides, [pid]: base } }));
}

/** Re-extract a conversation and upsert its summary into the workflow index. */
async function refreshIndexForConversation(
  get: Get,
  set: Set,
  pid: string,
  conversationId: string,
) {
  const convo = get().conversations(pid).find((c) => c.id === conversationId);
  if (!convo || convo.messages.length < 2) return;

  try {
    const res = await extractWorkflow({
      conversation: { id: convo.id, messages: convo.messages },
      existingIndex: get().index(pid),
    });
    if (!res.isWorkflow || !res.summary) return;
    const summary: WorkflowSummary = res.summary;

    const base = getIndexBase(get, pid).map((s) => ({ ...s, members: [...s.members] }));
    let target = base.find((s) => s.cluster === summary.cluster);
    if (!target) {
      target = {
        id: uid("ws"),
        cluster: summary.cluster,
        members: [],
        cueStatus: "none",
        updatedAt: now(),
      };
      base.unshift(target);
    }
    // Overwrite this conversation's member (one per conversation).
    target.members = target.members.filter((m) => m.conversationId !== conversationId);
    target.members.unshift(summary);
    target.updatedAt = now();
    set((s) => ({ indexOverrides: { ...s.indexOverrides, [pid]: base } }));
  } catch {
    /* extraction is best-effort */
  }
}
