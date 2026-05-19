"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Home, Plus } from "lucide-react";

import { AgentSidebarUser } from "@/components/agent/agent-sidebar-user";
import { getClientUser } from "@/lib/auth";
import { resolveUserAvatar } from "@/lib/user-avatar";
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
  const user = resolveUserAvatar(getClientUser());

  return (
    <aside className="wire-sidebar flex h-full flex-col">
      <nav className="flex flex-1 flex-col overflow-y-auto py-1" aria-label="Portalnavigation">
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
      {user ? (
        <footer className="wire-sidebar-user-footer">
          <AgentSidebarUser user={user} />
        </footer>
      ) : null}
    </aside>
  );
}
