"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ChatWorkspaceContextValue = Readonly<{
  activeChannelId: string | null;
  setActiveChannelId: (id: string | null) => void;
}>;

const ChatWorkspaceContext = createContext<ChatWorkspaceContextValue | null>(null);

export function ChatWorkspaceProvider({ children }: { children: ReactNode }) {
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);

  const value = useMemo(
    () => ({
      activeChannelId,
      setActiveChannelId,
    }),
    [activeChannelId],
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
