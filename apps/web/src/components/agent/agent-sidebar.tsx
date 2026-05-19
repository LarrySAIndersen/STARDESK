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
  UserCog,
  Users,
  UserCircle,
} from "lucide-react";

import { IntegrationSidebarLinks } from "@/components/integrations/integration-sidebar-links";
import { AgentSidebarUser } from "@/components/agent/agent-sidebar-user";
import { canManageUsers, getClientUser, isStaff } from "@/lib/auth";
import { resolveUserAvatar } from "@/lib/user-avatar";
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
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AgentSidebar({
  user: userFromServer,
  showUsersNav: showUsersNavFromServer,
}: {
  /** Server-parsed session user — avoids client cookie parse mismatches. */
  user?: User | null;
  /** When set by AgentShellWrapper, matches server admin check (JWT + cookie). */
  showUsersNav?: boolean;
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
    {
      href: "/portal",
      label: "Selvbetjeningsportal",
      icon: UserCircle,
      section: "Slutbrugere",
    },
  ];

  let lastSection: string | undefined;

  return (
    <aside className="wire-sidebar flex flex-col">
      <div className="wire-shell-col-header wire-shell-col-header--nav" aria-hidden />
      <nav className="flex flex-1 flex-col overflow-y-auto py-1" aria-label="Hovednavigation">
        {items.map((item) => {
          const showSection = item.section && item.section !== lastSection;
          if (item.section) lastSection = item.section;
          const Icon = item.icon;
          const active = isActive(pathname, item.href);

          const className = cn("wire-nav-item", active && "wire-nav-item--active");

          const inner = (
            <>
              <Icon className="size-[15px] shrink-0 opacity-60" aria-hidden />
              {item.label}
            </>
          );

          return (
            <div key={item.href + item.label}>
              {showSection ? (
                <p className="wire-nav-section">{item.section}</p>
              ) : null}
              <Link href={item.href} className={className}>
                {inner}
              </Link>
            </div>
          );
        })}
        {staff ? <IntegrationSidebarLinks pathname={pathname} /> : null}
      </nav>

      {user ? (
        <footer className="wire-sidebar-user-footer">
          <AgentSidebarUser user={resolveUserAvatar(user) ?? user} />
        </footer>
      ) : null}
    </aside>
  );
}
