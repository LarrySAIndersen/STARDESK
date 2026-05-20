"use client";

import Link from "next/link";

import { PortalLoggedInAs } from "@/components/portal/portal-logged-in-as";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { Button } from "@/components/ui/button";
import { canManageUsers, getClientUser, isStaff } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { User } from "@/types/user";

const NAV = [
  { href: "/", label: "Sager", staffOnly: false, adminOnly: false },
  { href: "/groups", label: "Grupper", staffOnly: true, adminOnly: false },
  { href: "/users", label: "Brugere", staffOnly: false, adminOnly: true },
  { href: "/reports", label: "Rapporter", staffOnly: true, adminOnly: false },
] as const;

export function SiteHeaderNav({
  user: serverUser,
  hideCasesAndNewTicket = false,
  industrialChrome = false,
}: {
  user?: User | null;
  hideCasesAndNewTicket?: boolean;
  industrialChrome?: boolean;
}) {
  const user = serverUser ?? getClientUser();
  const staff = isStaff(user);
  const admin = canManageUsers(user);

  const linkClass = industrialChrome
    ? "rounded-sm px-3 py-2 text-sm font-medium text-[#cbd5e1] transition-colors hover:bg-white/[0.08] hover:text-white"
    : "star-nav-link";

  const items = NAV.filter(
    (item) =>
      (!item.staffOnly || staff) &&
      (!item.adminOnly || admin) &&
      (!hideCasesAndNewTicket || item.href !== "/"),
  );

  return (
    <nav className="flex flex-wrap items-center gap-1" aria-label="Hovednavigation">
      {items.map((item) => (
        <Link key={item.href} href={item.href} className={linkClass}>
          {item.label}
        </Link>
      ))}
      {!hideCasesAndNewTicket ? (
        <Button
          nativeButton={false}
          render={<Link href="/tickets/new" />}
          className={cn(
            "ml-2 rounded-lg px-4 font-semibold shadow-sm",
            industrialChrome
              ? "border border-white/10 bg-[#003F8A] text-white hover:bg-[#002d66]"
              : "bg-primary hover:bg-primary/90",
          )}
        >
          Opret sag
        </Button>
      ) : null}
      <PortalLoggedInAs user={user} industrialChrome={industrialChrome} />
      <ThemeToggle />
      <UserMenu user={user} />
    </nav>
  );
}
