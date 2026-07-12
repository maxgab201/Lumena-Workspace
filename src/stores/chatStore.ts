import { create } from 'zustand';
import type { ChatMessage } from '../types/chat';

interface ChatStoreState {
  isChatOpen: boolean;
  messages: ChatMessage[];
  isGenerating: boolean;
  
  // Actions
  toggleChat: () => void;
  setChatOpen: (isOpen: boolean) => void;
  addMessage: (message: ChatMessage) => void;
  appendStreamChunk: (messageId: string, chunk: string) => void;
  setIsGenerating: (isGenerating: boolean) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatStoreState>((set) => ({
  isChatOpen: false,
  messages: [],
  isGenerating: false,

  toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen })),
  
  setChatOpen: (isOpen) => set({ isChatOpen: isOpen }),
  
  addMessage: (message) => set((state) => ({ 
    messages: [...state.messages, message] 
  })),

  appendStreamChunk: (messageId, chunk) => set((state) => ({
    messages: state.messages.map((m) => 
      m.id === messageId 
        ? { ...m, content: m.content + chunk }
        : m
    )
  })),

  setIsGenerating: (isGenerating) => set({ isGenerating }),
  
  clearMessages: () => set({ messages: [] })
}));
