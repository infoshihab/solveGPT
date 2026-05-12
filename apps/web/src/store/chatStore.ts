import { create } from "zustand";
import type { ProviderId } from "@/lib/models";
import { MODELS } from "@/lib/models";

export type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

type State = {
  conversationId: string | null;
  provider: ProviderId;
  model: string;
  messages: ChatMessage[];
  streaming: boolean;
  setProvider: (p: ProviderId) => void;
  setModel: (m: string) => void;
  setConversationId: (id: string | null) => void;
  setMessages: (m: ChatMessage[]) => void;
  appendAssistantChunk: (t: string) => void;
  finalizeAssistant: () => void;
  addUserMessage: (content: string) => void;
  addAssistantMessage: (content: string) => void;
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
  addUserMessage: (content) =>
    set((s) => ({ messages: [...s.messages, { role: "user", content }] })),
  addAssistantMessage: (content) =>
    set((s) => ({ messages: [...s.messages, { role: "assistant", content }] })),
  setStreaming: (streaming) => set({ streaming }),
  resetChat: () =>
    set({
      conversationId: null,
      messages: [],
      provider: defaultProvider,
      model: MODELS[defaultProvider][0]!.id,
    }),
}));
