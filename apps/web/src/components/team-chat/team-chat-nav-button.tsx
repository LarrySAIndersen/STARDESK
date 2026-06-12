"use client";

import { MessageSquare } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useChatWorkspaceOptional } from "@/components/team-chat/chat-workspace-provider";
import { cn } from "@/lib/utils";

/** Staff-only link to the full-page team chat (/chat). */
export function TeamChatNavButton({ collapsed }: { collapsed: boolean }) {
  const chat = useChatWorkspaceOptional();
  const pathname = usePathname();
  if (!chat) return null;

  const onChatPage = pathname === "/chat";
  const active = onChatPage || chat.open;

  return (
    <Link
      href="/chat"
      className={cn(
        "wire-nav-item w-full border-0 bg-transparent text-left no-underline",
        active && "wire-nav-item--active",
        collapsed && "wire-nav-item--compact",
      )}
      onClick={() => {
        if (chat.open) {
          chat.closeChat();
        }
      }}
      title="Team chat"
      aria-label="Team chat"
      aria-current={onChatPage ? "page" : undefined}
    >
      {collapsed ? (
        <MessageSquare className="size-[18px] shrink-0 opacity-70" aria-hidden />
      ) : (
        <>
          <MessageSquare className="size-[15px] shrink-0 opacity-60" aria-hidden />
          <span className="wire-nav-item__label min-w-0 flex-1 truncate">Chat</span>
        </>
      )}
    </Link>
  );
}
