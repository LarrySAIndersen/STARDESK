"use client";

import Link from "next/link";

import { UserMenu } from "@/components/user-menu";
import { Button } from "@/components/ui/button";
import { getClientUser, isStaff } from "@/lib/auth";

const NAV = [
  { href: "/", label: "Sager", staffOnly: false },
  { href: "/groups", label: "Grupper", staffOnly: true },
  { href: "/reports", label: "Rapporter", staffOnly: true },
] as const;

export function SiteHeaderNav() {
  const user = getClientUser();
  const staff = isStaff(user);

  return (
    <nav className="flex flex-wrap items-center gap-1">
      {NAV.filter((item) => !item.staffOnly || staff).map((item) => (
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
