"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";

import { TopBarUserMenu } from "@/components/agent/top-bar-user-menu";
import { HistoryBackButton } from "@/components/navigation/history-back-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { getClientUser } from "@/lib/auth";
import { portalRoleLabel } from "@/lib/portal-access";
import { resolveUserAvatar } from "@/lib/user-avatar";
import type { User } from "@/types/user";

const TITLES: Record<string, string> = {
  "/portal": "Oversigt",
  "/portal/knowledge": "Vidensartikler",
  "/tickets/new": "Opret sag",
  "/kundeportal-2": "Kundeportal #2",
  "/kundeportal-2/mine-sager": "Mine sager",
  "/kundeportal-2/mine-sager/udvidet": "Mine sager (udvidet)",
  "/kundeportal-2/statistik": "Statistik",
  "/kundeportal-2/service-requests": "Service Requests & Changes",
  "/kundeportal-2/soeg": "Søg",
  "/kundeportal-2/kvittering": "Kvittering",
};

function titleForPath(pathname: string): string {
  if (pathname.startsWith("/portal/knowledge/")) {
    return "Vidensartikel";
  }
  if (pathname.startsWith("/kundeportal-2/driftsmeddelelse/")) {
    return "Driftsmeddelelse";
  }
  if (pathname.startsWith("/kundeportal-2/service-requests/")) {
    return "Serviceanmodning";
  }
  return TITLES[pathname] ?? "Selvbetjening";
}

export function PortalTopBar({
  user: serverUser,
  onOpenNav,
}: {
  user?: User | null;
  onOpenNav?: () => void;
}) {
  const pathname = usePathname();
  const user = resolveUserAvatar(serverUser ?? getClientUser());

  if (!user) {
    return null;
  }

  return (
    <header className="wire-topbar">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <HistoryBackButton />
        {onOpenNav ? (
          <button
            type="button"
            onClick={onOpenNav}
            className="wire-touch-target text-muted-foreground hover:bg-accent hover:text-foreground -ml-1 flex items-center justify-center rounded-sm lg:hidden"
            aria-label="Åbn portalmenu"
          >
            <Menu className="size-5" aria-hidden />
          </button>
        ) : null}
        <h1 className={cn("wire-topbar-title min-w-0", onOpenNav && "flex-1")}>
          {titleForPath(pathname)}
        </h1>
      </div>
      <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-2">
        <ThemeToggle />
        <TopBarUserMenu user={{ ...user, role_label: portalRoleLabel(user) }} />
      </div>
    </header>
  );
}
