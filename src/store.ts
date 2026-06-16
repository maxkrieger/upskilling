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
import { createSkill, extractWorkflow, streamChat } from "./api.ts";

const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 10)}`;
const now = () => new Date().toISOString();

export type View = "chat" | "customize";

interface State {
  authed: boolean;
  activeProfileId: string;
  activeConversationId: string | null;
  view: View;
  sending: boolean;

  /** User-created (or promoted) conversations, keyed by profile id. */
  userConversations: Record<string, Conversation[]>;
  /** Workflow index overrides, keyed by profile id (seed when absent). */
  indexOverrides: Record<string, WorkflowSet[]>;
  /** Skills for this browser (builtin + user-created). */
  skills: Skill[];

  // selectors
  conversations: (profileId?: string) => Conversation[];
  index: (profileId?: string) => WorkflowSet[];
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
  toggleSkill: (id: string) => void;
  deleteSkill: (id: string) => void;
  addManualSkill: (name: string, description: string, instructions: string) => void;
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
      userConversations: {},
      indexOverrides: {},
      skills: BUILTIN_SKILLS,

      conversations: (profileId) =>
        mergeConversations(
          profileId ?? get().activeProfileId,
          get().userConversations[profileId ?? get().activeProfileId] ?? [],
        ),

      index: (profileId) => {
        const pid = profileId ?? get().activeProfileId;
        return get().indexOverrides[pid] ?? getProfile(pid)?.workflowIndex ?? [];
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

        const enabledSkills = get().skills.filter((s) => s.enabled);
        const history = convo.messages
          .filter((m) => m.id !== assistantMsg.id)
          .map((m) => ({ role: m.role, content: m.content, attachments: m.attachments }));

        await streamChat(
          {
            profileId: pid,
            profileName: profile.name,
            profileRole: profile.role,
            messages: history,
            skills: enabledSkills,
            workflowIndex: get().index(pid),
          },
          {
            onMeta: (meta: ChatMeta) => {
              writeConvos((c) => {
                const am = c.messages.find((m) => m.id === assistantMsg.id);
                if (am) {
                  am.appliedSkillIds = meta.appliedSkillIds;
                  if (meta.banner) am.banner = meta.banner;
                }
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

        set({ sending: false });
        // Re-extract this conversation's workflow summary (overwrite on each turn).
        void refreshIndexForConversation(get, set, pid, convo.id);
      },

      // ---- Accept a cue: create the skill from the workflow set ----
      acceptCue: async (conversationId, messageId) => {
        const pid = get().activeProfileId;
        const convo = get().conversations(pid).find((c) => c.id === conversationId);
        const msg = convo?.messages.find((m) => m.id === messageId);
        const banner = msg?.banner;
        if (!banner) return;

        const wfSet = get().index(pid).find((s) => s.id === banner.workflowSetId);
        if (!wfSet) return;

        // Mark the banner as in-progress.
        updateMessageBanner(set, pid, conversationId, messageId, { status: "accepted" });

        const memberConvos = get()
          .conversations(pid)
          .filter((c) => wfSet.members.some((m) => m.conversationId === c.id));

        try {
          const skill = await createSkill({ workflowSet: wfSet, conversations: memberConvos });
          set((s) => ({ skills: [...s.skills, skill] }));
          // Mark the set accepted + link skill.
          updateIndexSet(get, set, pid, wfSet.id, (ws) => {
            ws.cueStatus = "accepted";
            ws.skillId = skill.id;
          });
        } catch (e) {
          updateMessageBanner(set, pid, conversationId, messageId, { status: "pending" });
        }
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

      toggleSkill: (id) =>
        set((s) => ({
          skills: s.skills.map((sk) =>
            sk.id === id ? { ...sk, enabled: !sk.enabled } : sk,
          ),
        })),

      deleteSkill: (id) =>
        set((s) => ({
          // Builtin skills (e.g. skill-creator) can never be removed.
          skills: s.skills.filter((sk) => sk.source === "builtin" || sk.id !== id),
        })),

      addManualSkill: (name, description, instructions) =>
        set((s) => ({
          skills: [
            ...s.skills,
            {
              id: uid("skill"),
              name,
              description,
              instructions,
              source: "user",
              enabled: true,
              createdAt: now(),
            },
          ],
        })),
    }),
    {
      name: "upskilling-state",
      partialize: (s) => ({
        authed: s.authed,
        activeProfileId: s.activeProfileId,
        userConversations: s.userConversations,
        indexOverrides: s.indexOverrides,
        skills: s.skills,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        // Always ensure builtin skills are present.
        const skills = p.skills ?? current.skills;
        const withBuiltins = [
          ...BUILTIN_SKILLS.filter((b) => !skills.some((s) => s.id === b.id)),
          ...skills,
        ];
        return { ...current, ...p, skills: withBuiltins };
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
