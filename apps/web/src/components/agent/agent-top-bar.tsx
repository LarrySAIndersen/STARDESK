"use client";

import { usePathname } from "next/navigation";

import { TopBarUserMenu } from "@/components/agent/top-bar-user-menu";
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
}: {
  title?: string;
  actions?: React.ReactNode;
  user?: User | null;
}) {
  const pathname = usePathname();
  const displayTitle = title ?? titleForPath(pathname);
  const resolvedUser = user ? (resolveUserAvatar(user) ?? user) : null;

  return (
    <header className="wire-topbar">
      <h1 className="wire-topbar-title min-w-0 shrink">{displayTitle}</h1>
      <div className="ml-auto flex min-w-0 shrink-0 items-center gap-3">
        {actions}
        {resolvedUser ? <TopBarUserMenu user={resolvedUser} /> : null}
      </div>
    </header>
  );
}
