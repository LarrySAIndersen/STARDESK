"use client";

import { MessageSquare } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/** @deprecated Use agent nav item `team-chat` (/chat) instead. */
export function TeamChatNavButton({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const active = pathname === "/chat";

  return (
    <Link
      href="/chat"
      className={cn(
        "wire-nav-item w-full border-0 bg-transparent text-left no-underline",
        active && "wire-nav-item--active",
        collapsed && "wire-nav-item--compact",
      )}
      title="Team chat"
      aria-label="Team chat"
      aria-current={active ? "page" : undefined}
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
