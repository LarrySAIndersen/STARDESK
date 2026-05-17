"use client";

import Link from "next/link";

import { UserMenu } from "@/components/user-menu";
import { Button } from "@/components/ui/button";
import { canManageUsers, getClientUser, isStaff } from "@/lib/auth";

const NAV = [
  { href: "/", label: "Sager", staffOnly: false, adminOnly: false },
  { href: "/groups", label: "Grupper", staffOnly: true, adminOnly: false },
  { href: "/users", label: "Brugere", staffOnly: false, adminOnly: true },
  { href: "/reports", label: "Rapporter", staffOnly: true, adminOnly: false },
] as const;

export function SiteHeaderNav() {
  const user = getClientUser();
  const staff = isStaff(user);
  const admin = canManageUsers(user);

  return (
    <nav className="flex flex-wrap items-center gap-1" aria-label="Hovednavigation">
      {NAV.filter(
        (item) =>
          (!item.staffOnly || staff) && (!item.adminOnly || admin),
      ).map((item) => (
        <Link key={item.href} href={item.href} className="star-nav-link">
          {item.label}
        </Link>
      ))}
      <Button
        nativeButton={false}
        render={<Link href="/tickets/new" />}
        className="bg-star-blue hover:bg-star-navy ml-2 rounded-sm px-4 font-semibold"
      >
        Opret sag
      </Button>
      <UserMenu />
    </nav>
  );
}
