"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Home, LayoutGrid, Plus, UserCircle } from "lucide-react";

import { SidebarCollapseToggle } from "@/components/sidebar-collapse-toggle";
import { useShellNavPanelToggle } from "@/components/shell-nav-panel-context";
import { canAccessKundeportal2 } from "@/lib/kundeportal-2-access";
import { cn } from "@/lib/utils";
import type { User } from "@/types/user";

const BASE_ITEMS = [
  { href: "/portal", label: "Oversigt", icon: Home },
  { href: "/min-side", label: "Min side", icon: UserCircle },
  { href: "/portal/knowledge", label: "Vidensartikler", icon: BookOpen },
  { href: "/tickets/new", label: "Opret sag", icon: Plus },
] as const;

const KP2_ITEM = {
  href: "/kundeportal-2",
  label: "Kundeportal #2",
  icon: LayoutGrid,
} as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/portal") {
    return pathname === "/portal";
  }
  if (href === "/min-side") {
    return pathname === "/min-side" || pathname.startsWith("/min-side/");
  }
  if (href === "/kundeportal-2") {
    return pathname === "/kundeportal-2" || pathname.startsWith("/kundeportal-2/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PortalSidebar({
  collapsed = false,
  onToggle,
  onNavigate,
  user = null,
}: {
  collapsed?: boolean;
  onToggle?: () => void;
  onNavigate?: () => void;
  user?: User | null;
}) {
  const pathname = usePathname();
  const toggleNav = useShellNavPanelToggle(onToggle);
  const items = canAccessKundeportal2(user)
    ? [...BASE_ITEMS, KP2_ITEM]
    : [...BASE_ITEMS];

  return (
    <aside
      className={cn("wire-sidebar flex h-full flex-col", collapsed && "wire-sidebar--collapsed")}
      data-collapsed={collapsed ? "" : undefined}
    >
      {!collapsed ? (
        <div className="wire-shell-col-header wire-shell-col-header--nav flex items-center justify-end px-1">
          {onToggle ? <SidebarCollapseToggle collapsed={false} onToggle={toggleNav} /> : null}
        </div>
      ) : null}

      <nav className="flex flex-1 flex-col overflow-y-auto py-1" aria-label="Portalnavigation">
        {collapsed ? null : <p className="wire-nav-section">Selvbetjening</p>}
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              onClick={onNavigate}
              className={cn(
                "wire-nav-item",
                active && "wire-nav-item--active",
                collapsed && "wire-nav-item--compact",
              )}
            >
              <Icon className="size-[15px] shrink-0 opacity-60" aria-hidden />
              <span
                className={cn(
                  collapsed ? "min-w-0 flex-1 truncate" : "whitespace-nowrap",
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
      {collapsed && onToggle ? (
        <footer className="wire-sidebar-footer flex justify-center border-t border-border px-1.5 py-2">
          <SidebarCollapseToggle collapsed onToggle={toggleNav} />
        </footer>
      ) : null}
    </aside>
  );
}
