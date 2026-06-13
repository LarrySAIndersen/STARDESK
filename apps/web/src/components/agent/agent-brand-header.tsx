"use client";

import Link from "next/link";

import { AgentTopBarActions } from "@/components/agent/agent-top-bar-actions";
import { HelpABotChromeTrigger } from "@/components/agent/help-a-bot-chrome-trigger";
import { StarLogo } from "@/components/star-logo";
import type { User } from "@/types/user";

export function AgentBrandHeader({
  user,
  embedToolbar = false,
  showTeamChat = false,
  topBarActions,
}: Readonly<{
  user?: User | null;
  /** Home: chat, clock, theme and user menu live in the blue chrome bar. */
  embedToolbar?: boolean;
  showTeamChat?: boolean;
  topBarActions?: React.ReactNode;
}>) {
  return (
    <header className={embedToolbar ? "wire-topheader wire-topheader--toolbar" : "wire-topheader"}>
      <div className="flex min-w-0 flex-1 items-stretch gap-0">
        {embedToolbar ? (
          <>
            <Link href="/" className="flex shrink-0 items-center px-1">
              <StarLogo priority inverted />
            </Link>
            <div className="wire-topheader__brand-text">
              <span className="wire-topheader__brand-title">STARDesk</span>
              <span className="wire-topheader__brand-sub">STAR itsm</span>
            </div>
            <HelpABotChromeTrigger />
          </>
        ) : (
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
        )}
      </div>
      {embedToolbar ? (
        <AgentTopBarActions
          user={user}
          showTeamChat={showTeamChat}
          actions={topBarActions}
          variant="chrome"
        />
      ) : null}
    </header>
  );
}
