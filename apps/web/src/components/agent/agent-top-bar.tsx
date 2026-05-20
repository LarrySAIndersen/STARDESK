"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";

import { TopBarUserMenu } from "@/components/agent/top-bar-user-menu";
import { cn } from "@/lib/utils";
import { resolveUserAvatar } from "@/lib/user-avatar";
import type { User } from "@/types/user";

const TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/tickets": "Alle sager",
  "/tickets/new": "Ny sag",
  "/aktiver": "Aktiver",
  "/groups": "Grupper",
  "/users": "Brugere",
  "/reports": "Rapporter",
  "/admin/dependencies": "Afhængigheder & sikkerhed",
  "/portal": "Selvbetjeningsportal",
  "/integrations": "Integrationer",
  "/integrations/slack": "Slack",
  "/integrations/jira": "Jira",
  "/integrations/topdesk": "TOPdesk",
};

function titleForPath(pathname: string): string {
  if (pathname.endsWith("/overview")) {
    return "Tilknyttede sager";
  }
  if (pathname === "/tickets/major") {
    return "Store sager";
  }
  if (pathname.startsWith("/tickets/") && pathname !== "/tickets/new") {
    return "Sagsdetaljer";
  }
  return TITLES[pathname] ?? "STARdesk";
}

export function AgentTopBar({
  title,
  actions,
  user,
  onOpenNav,
}: {
  title?: string;
  actions?: React.ReactNode;
  user?: User | null;
  onOpenNav?: () => void;
}) {
  const pathname = usePathname();
  const displayTitle = title ?? titleForPath(pathname);
  const resolvedUser = user ? (resolveUserAvatar(user) ?? user) : null;

  return (
    <header className="wire-topbar">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:gap-3">
        {onOpenNav ? (
          <button
            type="button"
            onClick={onOpenNav}
            className="wire-touch-target wire-topbar-menu-btn text-[var(--gray-mid)] hover:bg-star-blue-light hover:text-star-navy -ml-1 flex items-center justify-center rounded-sm lg:hidden"
            aria-label="Åbn navigation"
          >
            <Menu className="size-5" aria-hidden />
          </button>
        ) : null}
        <h1 className={cn("wire-topbar-title min-w-0", onOpenNav && "flex-1")}>
          {displayTitle}
        </h1>
      </div>
      <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
        {actions}
        {resolvedUser ? <TopBarUserMenu user={resolvedUser} /> : null}
      </div>
    </header>
  );
}
