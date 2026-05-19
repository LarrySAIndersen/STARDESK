"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Home, Plus } from "lucide-react";

import { SidebarCollapseToggle } from "@/components/sidebar-collapse-toggle";
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

export function PortalSidebar({
  collapsed = false,
  onToggle,
}: {
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={cn("wire-sidebar flex h-full flex-col", collapsed && "wire-sidebar--collapsed")}
      data-collapsed={collapsed ? "" : undefined}
    >
      {!collapsed ? (
        <div className="wire-shell-col-header wire-shell-col-header--nav flex items-center justify-end px-1">
          {onToggle ? <SidebarCollapseToggle collapsed={false} onToggle={onToggle} /> : null}
        </div>
      ) : null}

      <nav className="flex flex-1 flex-col overflow-y-auto py-1" aria-label="Portalnavigation">
        {collapsed ? null : <p className="wire-nav-section">Selvbetjening</p>}
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "wire-nav-item",
                active && "wire-nav-item--active",
                collapsed && "wire-nav-item--icon-only",
              )}
            >
              <Icon className="size-[15px] shrink-0 opacity-60" aria-hidden />
              {collapsed ? <span className="sr-only">{item.label}</span> : item.label}
            </Link>
          );
        })}
      </nav>
      {collapsed && onToggle ? (
        <footer className="wire-sidebar-footer flex justify-center border-t border-[var(--gray-border)] px-1.5 py-2">
          <SidebarCollapseToggle collapsed onToggle={onToggle} />
        </footer>
      ) : null}
    </aside>
  );
}
