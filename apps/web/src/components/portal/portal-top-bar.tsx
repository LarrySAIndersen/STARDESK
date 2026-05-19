"use client";

import { usePathname } from "next/navigation";

import { TopBarUserMenu } from "@/components/agent/top-bar-user-menu";
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

export function PortalTopBar() {
  const pathname = usePathname();
  const user = resolveUserAvatar(getClientUser());

  if (!user) {
    return null;
  }

  return (
    <header className="wire-topbar">
      <h1 className="wire-topbar-title min-w-0 shrink">{titleForPath(pathname)}</h1>
      <div className="ml-auto flex min-w-0 shrink-0 items-center">
        <TopBarUserMenu user={{ ...user, role_label: portalRoleLabel(user) }} />
      </div>
    </header>
  );
}
