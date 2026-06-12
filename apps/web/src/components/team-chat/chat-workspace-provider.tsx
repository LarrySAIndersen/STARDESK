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
import { usePathname } from "next/navigation";

import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";

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
  return localStorage.getItem(STORAGE_KEY) === "true";
}

export function ChatWorkspaceProvider({
  children,
  enabled = true,
}: {
  children: ReactNode;
  enabled?: boolean;
}) {
  const pathname = usePathname();
  const isChatPage = pathname === "/chat";
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

  useEffect(() => {
    if (isChatPage) {
      closeChat();
    }
  }, [isChatPage, closeChat]);

  useKeyboardShortcut("c", toggle, {
    shift: true,
    enabled: enabled && hydrated && !isChatPage,
  });

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
