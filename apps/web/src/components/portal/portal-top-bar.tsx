"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";

import { TopBarUserMenu } from "@/components/agent/top-bar-user-menu";
import { cn } from "@/lib/utils";
import { getClientUser } from "@/lib/auth";
import { portalRoleLabel } from "@/lib/portal-access";
import { resolveUserAvatar } from "@/lib/user-avatar";

const TITLES: Record<string, string> = {
  "/portal": "Oversigt",
  "/portal/knowledge": "Vidensartikler",
  "/tickets/new": "Opret sag",
};

function titleForPath(pathname: string): string {
  if (pathname.startsWith("/portal/knowledge/")) {
    return "Vidensartikel";
  }
  return TITLES[pathname] ?? "Selvbetjening";
}

export function PortalTopBar({ onOpenNav }: { onOpenNav?: () => void }) {
  const pathname = usePathname();
  const user = resolveUserAvatar(getClientUser());

  if (!user) {
    return null;
  }

  return (
    <header className="wire-topbar">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {onOpenNav ? (
          <button
            type="button"
            onClick={onOpenNav}
            className="wire-touch-target text-[var(--gray-mid)] hover:bg-star-blue-light hover:text-star-navy -ml-1 flex items-center justify-center rounded-sm lg:hidden"
            aria-label="Åbn portalmenu"
          >
            <Menu className="size-5" aria-hidden />
          </button>
        ) : null}
        <h1 className={cn("wire-topbar-title min-w-0", onOpenNav && "flex-1")}>
          {titleForPath(pathname)}
        </h1>
      </div>
      <div className="flex min-w-0 shrink-0 items-center">
        <TopBarUserMenu user={{ ...user, role_label: portalRoleLabel(user) }} />
      </div>
    </header>
  );
}
