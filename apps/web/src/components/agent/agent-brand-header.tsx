"use client";

import Link from "next/link";

import { StarLogo } from "@/components/star-logo";

export function AgentBrandHeader() {
  return (
    <header className="wire-topheader">
      <Link href="/" className="flex min-w-0 shrink-0 items-center gap-3">
        <StarLogo priority inverted showOrgSubtitle />
        <span
          className="mx-0.5 hidden h-8 w-px shrink-0 bg-white/30 sm:block"
          aria-hidden="true"
        />
        <span className="text-base font-bold tracking-tight text-white sm:text-[17px]">
          STAR<span className="font-semibold text-white/90">desk</span>
        </span>
      </Link>
    </header>
  );
}
