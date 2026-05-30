"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/forbedringer", label: "Review-sedler", exact: true },
  { href: "/forbedringer/saglayout-2", label: "Saglayout #2", exact: false },
] as const;

export function ForbedringerSubnav() {
  const pathname = usePathname();

  return (
    <nav
      className="border-border flex flex-wrap gap-1 border-b pb-3"
      aria-label="Forbedringer"
    >
      {LINKS.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "rounded-[2px] px-3 py-1.5 text-[13px] font-medium transition-colors",
              active
                ? "bg-star-navy text-white"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            aria-current={active ? "page" : undefined}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
