import { create } from "zustand";
import type { ProviderId } from "@/lib/models";
import { MODELS } from "@/lib/models";

export type FileAttachment = { id: string; name: string; mime: string; dataUrl: string };

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  attachments?: FileAttachment[];
};

type State = {
  conversationId: string | null;
  provider: ProviderId;
  model: string;
  messages: ChatMessage[];
  pendingAttachments: FileAttachment[];
  streaming: boolean;
  setProvider: (p: ProviderId) => void;
  setModel: (m: string) => void;
  setConversationId: (id: string | null) => void;
  setMessages: (m: ChatMessage[]) => void;
  appendAssistantChunk: (t: string) => void;
  finalizeAssistant: () => void;
  addUserMessage: (content: string, attachments?: FileAttachment[]) => void;
  addAssistantMessage: (content: string) => void;
  addPendingAttachment: (a: FileAttachment) => void;
  removePendingAttachment: (id: string) => void;
  clearPendingAttachments: () => void;
  setStreaming: (v: boolean) => void;
  resetChat: () => void;
};

const defaultProvider: ProviderId = "openai";
const defaultModel = MODELS[defaultProvider][0]!.id;

export const useChatStore = create<State>((set, get) => ({
  conversationId: null,
  provider: defaultProvider,
  model: defaultModel,
  messages: [],
  pendingAttachments: [],
  streaming: false,
  setProvider: (p) =>
    set({
      provider: p,
      model: MODELS[p][0]?.id ?? defaultModel,
    }),
  setModel: (m) => set({ model: m }),
  setConversationId: (id) => set({ conversationId: id }),
  setMessages: (messages) => set({ messages }),
  appendAssistantChunk: (t) => {
    const msgs = [...get().messages];
    const last = msgs[msgs.length - 1];
    if (last?.role === "assistant") {
      last.content += t;
    } else {
      msgs.push({ role: "assistant", content: t });
    }
    set({ messages: msgs });
  },
  finalizeAssistant: () => {},
  addUserMessage: (content, attachments) =>
    set((s) => ({
      messages: [
        ...s.messages,
        {
          role: "user",
          content,
          attachments: attachments?.length ? attachments : undefined,
        },
      ],
    })),
  addAssistantMessage: (content) =>
    set((s) => ({ messages: [...s.messages, { role: "assistant", content }] })),
  addPendingAttachment: (a) =>
    set((s) => ({ pendingAttachments: [...s.pendingAttachments, a] })),
  removePendingAttachment: (id) =>
    set((s) => ({ pendingAttachments: s.pendingAttachments.filter((x) => x.id !== id) })),
  clearPendingAttachments: () => set({ pendingAttachments: [] }),
  setStreaming: (streaming) => set({ streaming }),
  resetChat: () =>
    set({
      conversationId: null,
      messages: [],
      pendingAttachments: [],
      provider: defaultProvider,
      model: MODELS[defaultProvider][0]!.id,
    }),
}));
