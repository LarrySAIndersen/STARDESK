"use client";

import { MessageSquare } from "lucide-react";

import { useChatWorkspaceOptional } from "@/components/team-chat/chat-workspace-provider";
import { cn } from "@/lib/utils";

/** Staff-only chat toggle in the left nav (not a route). */
export function TeamChatNavButton({ collapsed }: { collapsed: boolean }) {
  const chat = useChatWorkspaceOptional();
  if (!chat) return null;

  const active = chat.open;

  return (
    <button
      type="button"
      className={cn(
        "wire-nav-item w-full border-0 bg-transparent text-left",
        active && "wire-nav-item--active",
        collapsed && "wire-nav-item--compact",
      )}
      onClick={chat.toggle}
      title="Team chat (Ctrl+Shift+C)"
      aria-label="Team chat"
      aria-pressed={active}
    >
      {collapsed ? (
        <MessageSquare className="size-[18px] shrink-0 opacity-70" aria-hidden />
      ) : (
        <>
          <MessageSquare className="size-[15px] shrink-0 opacity-60" aria-hidden />
          <span className="wire-nav-item__label min-w-0 flex-1 truncate">Chat</span>
          <span className="text-muted-foreground text-[9px]">⇧C</span>
        </>
      )}
    </button>
  );
}
