"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Home, Plus } from "lucide-react";

import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/portal", label: "Oversigt", icon: Home },
  { href: "/portal/knowledge", label: "Vidensartikler", icon: BookOpen },
  { href: "/tickets/new", label: "Opret sag", icon: Plus },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/portal") {
    return pathname === "/portal";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PortalSidebar() {
  const pathname = usePathname();

  return (
    <aside className="wire-sidebar w-[200px] shrink-0 border-r border-[var(--gray-border)]">
      <nav className="flex flex-col py-1" aria-label="Portalnavigation">
        <p className="wire-nav-section">Selvbetjening</p>
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn("wire-nav-item", active && "wire-nav-item--active")}
            >
              <Icon className="size-[15px] shrink-0 opacity-60" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
