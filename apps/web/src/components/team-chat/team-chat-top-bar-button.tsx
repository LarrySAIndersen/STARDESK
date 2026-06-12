"use client";

import { MessageSquare } from "lucide-react";
import { usePathname } from "next/navigation";

import { useChatWorkspaceOptional } from "@/components/team-chat/chat-workspace-provider";
import { cn } from "@/lib/utils";

/** Staff-only team chat toggle — docks panel below the locked top bar. */
export function TeamChatTopBarButton() {
  const chat = useChatWorkspaceOptional();
  const pathname = usePathname();
  if (!chat) return null;

  const onChatPage = pathname === "/chat";
  const active = onChatPage || chat.open;

  return (
    <button
      type="button"
      className={cn(
        "wire-topbar-team-chat-btn",
        active && "wire-topbar-team-chat-btn--active",
      )}
      onClick={() => chat.toggle()}
      aria-label="Team chat"
      aria-pressed={chat.open}
      title="Team chat (Ctrl+Shift+C)"
    >
      <MessageSquare className="size-4" aria-hidden />
    </button>
  );
}
