"use client";

import { MessageSquare } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/** @deprecated Chat lives at /chat only — use left nav link instead. */
export function TeamChatTopBarButton() {
  const pathname = usePathname();
  const active = pathname === "/chat";

  return (
    <Link
      href="/chat"
      className={cn(
        "wire-topbar-team-chat-btn",
        active && "wire-topbar-team-chat-btn--active",
      )}
      aria-label="Team chat"
      aria-current={active ? "page" : undefined}
      title="Team chat"
    >
      <MessageSquare className="size-4" aria-hidden />
    </Link>
  );
}
