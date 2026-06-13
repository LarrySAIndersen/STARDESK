"use client";

import { MessageSquare } from "lucide-react";
import { usePathname } from "next/navigation";

import { useChatWorkspaceOptional } from "@/components/team-chat/chat-workspace-provider";
import { cn } from "@/lib/utils";

/** Staff-only toggle — opens floating STARchat panel. */
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
      onClick={() => {
        if (!onChatPage) {
          chat.toggle();
        }
      }}
      disabled={onChatPage}
      aria-label="Team chat"
      aria-pressed={onChatPage ? undefined : chat.open}
      aria-current={onChatPage ? "page" : undefined}
      title={onChatPage ? "Team chat (fuld side)" : "Team chat (Ctrl+Shift+C)"}
    >
      <MessageSquare className="size-4" aria-hidden />
    </button>
  );
}
