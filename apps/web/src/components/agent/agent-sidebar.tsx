"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  LayoutDashboard,
  MessageSquare,
  Plus,
  Ticket,
  UserCog,
  Users,
  UserCircle,
} from "lucide-react";

import { canManageUsers, getClientUser, isStaff } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { User } from "@/types/user";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  section?: string;
  onClick?: () => void;
};

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/tickets") {
    return pathname === "/tickets";
  }
  if (href === "/tickets/new") {
    return pathname === "/tickets/new";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AgentSidebar({
  user: userFromServer,
  showUsersNav: showUsersNavFromServer,
  onSlackClick,
}: {
  /** Server-parsed session user — avoids client cookie parse mismatches. */
  user?: User | null;
  /** When set by AgentShellWrapper, matches server admin check (JWT + cookie). */
  showUsersNav?: boolean;
  onSlackClick?: () => void;
}) {
  const pathname = usePathname();
  const user = userFromServer ?? getClientUser();
  const staff = isStaff(user);
  const showAdmin = showUsersNavFromServer ?? canManageUsers(user);

  const initials = user?.display_name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() ?? "?";

  const items: NavItem[] = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard, section: "Techniker" },
    { href: "/tickets", label: "Alle sager", icon: Ticket },
    { href: "/tickets/new", label: "Ny sag", icon: Plus },
    ...(staff ? [{ href: "/groups", label: "Grupper", icon: Users }] : []),
    ...(showAdmin ? [{ href: "/users", label: "Brugere", icon: UserCog }] : []),
    { href: "/reports", label: "Rapporter", icon: BarChart3 },
    {
      href: "/portal",
      label: "Selvbetjeningsportal",
      icon: UserCircle,
      section: "Slutbrugere",
    },
    {
      href: "#slack",
      label: "Slack",
      icon: MessageSquare,
      section: "Integration",
      onClick: onSlackClick,
    },
  ];

  let lastSection: string | undefined;

  return (
    <aside className="wire-sidebar">
      <nav className="flex flex-1 flex-col overflow-y-auto py-1" aria-label="Hovednavigation">
        {items.map((item) => {
          const showSection = item.section && item.section !== lastSection;
          if (item.section) lastSection = item.section;
          const Icon = item.icon;
          const active = !item.onClick && isActive(pathname, item.href);

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
              {item.onClick ? (
                <button type="button" className={className} onClick={item.onClick}>
                  {inner}
                </button>
              ) : (
                <Link href={item.href} className={className}>
                  {inner}
                </Link>
              )}
            </div>
          );
        })}
      </nav>

      {user ? (
        <footer className="flex items-center gap-2 border-t border-[var(--gray-border)] px-3.5 py-3">
          <span
            className="wire-avatar-sm bg-[var(--star-navy-dark)]"
            aria-hidden
          >
            {initials}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-bold text-star-navy">
              {user.display_name}
            </p>
            <p className="truncate text-[10px] text-[var(--gray-mid)]">
              {user.role_label}
            </p>
            </div>
        </footer>
      ) : null}
    </aside>
  );
}
