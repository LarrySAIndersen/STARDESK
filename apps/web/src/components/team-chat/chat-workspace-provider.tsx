"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";
import { readTeamChatOpenFromStorage } from "@/lib/team-chat-utils";

const STORAGE_KEY = "stardesk_team_chat_open";

type ChatWorkspaceContextValue = Readonly<{
  open: boolean;
  toggle: () => void;
  openChat: () => void;
  closeChat: () => void;
  activeChannelId: string | null;
  setActiveChannelId: (id: string | null) => void;
}>;

const ChatWorkspaceContext = createContext<ChatWorkspaceContextValue | null>(null);

function readStoredOpen(): boolean {
  if (typeof window === "undefined") return false;
  return readTeamChatOpenFromStorage(localStorage.getItem(STORAGE_KEY));
}

export function ChatWorkspaceProvider({
  children,
  enabled = true,
}: {
  children: ReactNode;
  enabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);

  useEffect(() => {
    setOpen(readStoredOpen());
    setHydrated(true);
  }, []);

  const persist = useCallback((next: boolean) => {
    setOpen(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "true" : "false");
    } catch {
      // ignore
    }
  }, []);

  const toggle = useCallback(() => {
    persist(!open);
  }, [open, persist]);

  const openChat = useCallback(() => persist(true), [persist]);
  const closeChat = useCallback(() => persist(false), [persist]);

  useKeyboardShortcut("c", toggle, { shift: true, enabled: enabled && hydrated });

  const value = useMemo(
    () => ({
      open,
      toggle,
      openChat,
      closeChat,
      activeChannelId,
      setActiveChannelId,
    }),
    [open, toggle, openChat, closeChat, activeChannelId],
  );

  return (
    <ChatWorkspaceContext.Provider value={value}>{children}</ChatWorkspaceContext.Provider>
  );
}

export function useChatWorkspace(): ChatWorkspaceContextValue {
  const ctx = useContext(ChatWorkspaceContext);
  if (!ctx) {
    throw new Error("useChatWorkspace must be used within ChatWorkspaceProvider");
  }
  return ctx;
}

export function useChatWorkspaceOptional(): ChatWorkspaceContextValue | null {
  return useContext(ChatWorkspaceContext);
}
