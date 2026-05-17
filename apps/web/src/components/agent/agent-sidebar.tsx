"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  LayoutDashboard,
  Plus,
  Ticket,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/#agent-workspace", label: "Sager", icon: Ticket },
  { href: "/groups", label: "Grupper", icon: Users },
  { href: "/reports", label: "Rapporter", icon: BarChart3 },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  if (href === "/#agent-workspace") {
    return pathname.startsWith("/tickets");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AgentSidebar() {
  const pathname = usePathname();

  return (
    <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border flex h-full min-h-0 flex-col overflow-hidden border-r">
      <nav
        className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4"
        aria-label="Hovednavigation"
      >
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "ledger-nav-link",
                active && "ledger-nav-link--active",
              )}
            >
              <Icon className="size-[18px] shrink-0 stroke-[1.75]" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <footer className="border-sidebar-border shrink-0 border-t p-4">
        <Button
          nativeButton={false}
          render={<Link href="/tickets/new" />}
          className="bg-primary hover:bg-primary/90 w-full justify-center gap-2 rounded-lg font-semibold shadow-sm"
        >
          <Plus className="size-4" aria-hidden />
          Opret sag
        </Button>
      </footer>
    </aside>
  );
}
