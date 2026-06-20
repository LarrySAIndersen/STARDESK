"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";

import { AgentTopBarActions } from "@/components/agent/agent-top-bar-actions";
import { HistoryBackButton } from "@/components/navigation/history-back-button";
import { SidebarCollapseToggle } from "@/components/sidebar-collapse-toggle";
import { useShellNavPanelToggle } from "@/components/shell-nav-panel-context";
import { useIsLgUp } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import type { User } from "@/types/user";

const TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/service-desk": "Service Desk",
  "/projekter": "Projektoversigt",
  "/kanban": "Kanban",
  "/backlog": "Backlog",
  "/sitemap": "Sitemap",
  "/arbejdsrum": "Arbejdsrum",
  "/tickets": "Alle sager",
  "/tickets/new": "Ny sag",
  "/aktiver": "Aktiver",
  "/knowledge": "Vidensartikler",
  "/groups": "Grupper",
  "/tasks": "Opgaver",
  "/users": "Brugere",
  "/reports": "Rapporter",
  "/forbedringer": "Review-sedler",
  "/forbedringer/saglayout-2": "Saglayout #2",
  "/admin/dashboard": "Admin dashboard",
  "/admin/sla": "SLA-indstillinger",
  "/admin/categories": "Kategorier",
  "/admin/dependencies": "Afhængigheder & sikkerhed",
  "/portal": "Selvbetjeningsportal",
  "/integrations": "Integrationer",
  "/integrations/slack": "Slack",
  "/integrations/jira": "Jira",
  "/integrations/topdesk": "TOPdesk",
  "/chat": "STARchat",
  "/indstillinger": "Personlige indstillinger",
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
  showTeamChat = false,
  hideActions = false,
  chromeTitle = false,
  navCollapsed = false,
  onToggleNav,
}: {
  title?: string;
  actions?: React.ReactNode;
  user?: User | null;
  onOpenNav?: () => void;
  showTeamChat?: boolean;
  /** Utilities live in blue chrome — only page title remains here. */
  hideActions?: boolean;
  /** Slim title row: collapse + back + title flush left. */
  chromeTitle?: boolean;
  navCollapsed?: boolean;
  onToggleNav?: () => void;
}) {
  const pathname = usePathname();
  const isLgUp = useIsLgUp();
  const toggleNav = useShellNavPanelToggle(onToggleNav ?? (() => undefined));
  const displayTitle = title ?? titleForPath(pathname);
  const showDesktopNavToggle = chromeTitle && isLgUp && onToggleNav;

  return (
    <header className={cn("wire-topbar", chromeTitle && "wire-topbar--chrome")}>
      <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
        {showDesktopNavToggle ? (
          <SidebarCollapseToggle collapsed={navCollapsed} onToggle={toggleNav} />
        ) : null}
        <HistoryBackButton />
        {!onOpenNav ? null : (
          <button
            type="button"
            onClick={onOpenNav}
            className="wire-touch-target wire-topbar-menu-btn text-muted-foreground hover:bg-accent hover:text-foreground -ml-1 flex items-center justify-center rounded-sm lg:hidden"
            aria-label="Åbn navigation"
          >
            <Menu className="size-5" aria-hidden />
          </button>
        )}
        <h1 className={cn("wire-topbar-title min-w-0", onOpenNav && "flex-1")}>
          {displayTitle}
        </h1>
      </div>
      {hideActions ? null : (
        <AgentTopBarActions
          user={user}
          showTeamChat={showTeamChat}
          actions={actions}
        />
      )}
    </header>
  );
}
