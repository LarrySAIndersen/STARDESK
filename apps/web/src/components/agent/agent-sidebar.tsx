"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Layers,
  LayoutDashboard,
  Library,
  Plus,
  Ticket,
  Shield,
  UserCog,
  Users,
  UserCircle,
} from "lucide-react";

import { IntegrationSidebarLinks } from "@/components/integrations/integration-sidebar-links";
import { SidebarCollapseToggle } from "@/components/sidebar-collapse-toggle";
import { StarLogo } from "@/components/star-logo";
import { canManageUsers, getClientUser, isStaff } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { User } from "@/types/user";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  section?: string;
};

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/tickets") {
    return pathname === "/tickets";
  }
  if (href === "/tickets/new") {
    return pathname === "/tickets/new";
  }
  if (href === "/aktiver") {
    return pathname === "/aktiver";
  }
  if (href === "/knowledge") {
    return pathname === "/knowledge" || pathname.startsWith("/knowledge/");
  }
  if (href === "/integrations") {
    return pathname === "/integrations" || pathname.startsWith("/integrations/");
  }
  if (href === "/admin/dependencies") {
    return pathname === "/admin/dependencies" || pathname.startsWith("/admin/dependencies/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AgentSidebar({
  user: userFromServer,
  showUsersNav: showUsersNavFromServer,
  collapsed = false,
  onToggle,
}: {
  /** Server-parsed session user — avoids client cookie parse mismatches. */
  user?: User | null;
  /** When set by AgentShellWrapper, matches server admin check (JWT + cookie). */
  showUsersNav?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  const pathname = usePathname();
  const user = userFromServer ?? getClientUser();
  const staff = isStaff(user);
  const showAdmin = showUsersNavFromServer ?? canManageUsers(user);

  const items: NavItem[] = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/tickets", label: "Alle sager", icon: Ticket },
    { href: "/tickets/new", label: "Ny sag", icon: Plus },
    ...(staff ? [{ href: "/aktiver", label: "Aktiver", icon: Layers }] : []),
    ...(staff
      ? [{ href: "/knowledge", label: "Vidensartikler", icon: Library }]
      : []),
    ...(staff ? [{ href: "/groups", label: "Grupper", icon: Users }] : []),
    ...(showAdmin ? [{ href: "/users", label: "Brugere", icon: UserCog }] : []),
    { href: "/reports", label: "Rapporter", icon: BarChart3 },
    ...(showAdmin
      ? [
          {
            href: "/admin/dependencies",
            label: "Afhængigheder & sikkerhed",
            icon: Shield,
            section: "Administration",
          },
        ]
      : []),
    {
      href: "/portal",
      label: "Selvbetjeningsportal",
      icon: UserCircle,
      section: "Slutbrugere",
    },
  ];

  let lastSection: string | undefined;

  return (
    <aside
      className={cn("wire-sidebar flex flex-col", collapsed && "wire-sidebar--collapsed")}
      data-collapsed={collapsed ? "" : undefined}
    >
      {collapsed ? (
        <div className="wire-sidebar-collapsed-brand">
          <Link href="/" className="flex items-center justify-center" title="STARdesk">
            <StarLogo priority inverted className="h-6 w-auto" />
          </Link>
        </div>
      ) : (
        <div className="wire-shell-col-header wire-shell-col-header--nav flex items-center justify-end px-1">
          {onToggle ? <SidebarCollapseToggle collapsed={false} onToggle={onToggle} /> : null}
        </div>
      )}

      <nav
        className="flex flex-1 flex-col overflow-y-auto py-1"
        aria-label="Hovednavigation"
      >
        {items.map((item) => {
          const showSection = !collapsed && item.section && item.section !== lastSection;
          if (item.section) lastSection = item.section;
          const Icon = item.icon;
          const active = isActive(pathname, item.href);

          const className = cn(
            "wire-nav-item",
            active && "wire-nav-item--active",
            collapsed && "wire-nav-item--icon-only",
          );

          return (
            <div key={item.href + item.label}>
              {showSection ? (
                <p className="wire-nav-section">{item.section}</p>
              ) : null}
              <Link href={item.href} className={className} title={collapsed ? item.label : undefined}>
                <Icon className="size-[15px] shrink-0 opacity-60" aria-hidden />
                {collapsed ? (
                  <span className="sr-only">{item.label}</span>
                ) : (
                  item.label
                )}
              </Link>
            </div>
          );
        })}
        {staff ? (
          <IntegrationSidebarLinks pathname={pathname} collapsed={collapsed} />
        ) : null}
      </nav>

      {collapsed && onToggle ? (
        <footer className="wire-sidebar-footer flex justify-center border-t border-[var(--gray-border)] px-1.5 py-2">
          <SidebarCollapseToggle collapsed onToggle={onToggle} />
        </footer>
      ) : null}
    </aside>
  );
}
