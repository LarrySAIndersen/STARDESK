"use client";

import Link from "next/link";

import { StarLogo } from "@/components/star-logo";

export function AgentBrandHeader() {
  return (
    <header className="wire-topheader">
      <Link href="/" className="flex shrink-0 items-center gap-3">
        <StarLogo priority inverted className="h-9 w-auto" />
        <span className="border-l border-white/30 pl-4 text-sm font-semibold text-white">
          Servicedesk
        </span>
      </Link>
    </header>
  );
}
