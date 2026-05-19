"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/tickets": "Alle sager",
  "/tickets/new": "Ny sag",
  "/aktiver": "Aktiver",
  "/groups": "Grupper",
  "/users": "Brugere",
  "/reports": "Rapporter",
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
}: {
  title?: string;
  actions?: React.ReactNode;
}) {
  const pathname = usePathname();
  const displayTitle = title ?? titleForPath(pathname);

  return (
    <header className="wire-topbar">
      <h1 className="wire-topbar-title">{displayTitle}</h1>
      <div className="flex items-center gap-2">
        {actions}
        {pathname !== "/tickets/new" ? (
          <Link href="/tickets/new" className="wire-btn wire-btn-red wire-btn-sm">
            + Ny sag
          </Link>
        ) : null}
      </div>
    </header>
  );
}
