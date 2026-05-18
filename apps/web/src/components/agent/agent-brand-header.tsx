"use client";

import Link from "next/link";

import { StarLogo } from "@/components/star-logo";
import { getClientUser } from "@/lib/auth";

export function AgentBrandHeader() {
  const user = getClientUser();
  const initials = user?.display_name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() ?? "?";

  return (
    <header className="wire-topheader">
      <Link href="/" className="flex shrink-0 items-center gap-3">
        <StarLogo priority inverted className="h-9 w-auto" />
        <span className="border-l border-white/30 pl-4 text-sm font-semibold text-white">
          Servicedesk
        </span>
      </Link>
      <div className="ml-auto flex items-center gap-3">
        {user ? (
          <>
            <span className="hidden text-xs text-white/80 sm:inline">{user.email}</span>
            <span className="wire-avatar-sm" aria-hidden>
              {initials}
            </span>
          </>
        ) : null}
      </div>
    </header>
  );
}
