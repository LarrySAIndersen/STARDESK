"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Eye, EyeOff, LayoutGrid } from "lucide-react";

import { IntegrationSidebarLinks } from "@/components/integrations/integration-sidebar-links";
import { SidebarCollapseToggle } from "@/components/sidebar-collapse-toggle";
import { SidebarUiModeSwitch } from "@/components/sidebar-ui-mode-switch";
import { useSidebarNavVisibility } from "@/hooks/use-sidebar-nav-visibility";
import {
  buildAgentNavItems,
  filterNavItemsForViewer,
  type AgentNavItem,
} from "@/lib/agent-nav";
import { canManageUsers, getClientUser, isStaff, isTopAdmin } from "@/lib/auth";
import { canChooseClassicUi } from "@/lib/classic-ui-mode";
import { cn } from "@/lib/utils";
import type { User } from "@/types/user";

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/tickets") {
    return pathname === "/tickets";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavVisibilityToggle({
  navId,
  hidden,
  collapsed,
  onToggle,
}: {
  navId: string;
  hidden: boolean;
  collapsed: boolean;
  onToggle: (navId: string, hide: boolean) => void;
}) {
  if (collapsed) {
    return null;
  }
  return (
    <button
      type="button"
      className="text-muted-foreground hover:text-star-navy ml-auto shrink-0 rounded p-0.5"
      title={hidden ? "Vis for andre brugere" : "Skjul for andre brugere"}
      aria-label={hidden ? "Vis menupunkt for andre" : "Skjul menupunkt for andre"}
      aria-pressed={hidden}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void onToggle(navId, !hidden);
      }}
    >
      {hidden ? <EyeOff className="size-3.5" aria-hidden /> : <Eye className="size-3.5" aria-hidden />}
    </button>
  );
}

function NavRow({
  item,
  pathname,
  collapsed,
  onNavigate,
  manageVisibility,
  hiddenNavIds,
  onToggleHidden,
}: {
  item: AgentNavItem;
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
  manageVisibility: boolean;
  hiddenNavIds: string[];
  onToggleHidden: (navId: string, hide: boolean) => void;
}) {
  const Icon = item.icon;
  const active = isActive(pathname, item.href);
  const isHiddenForOthers = hiddenNavIds.includes(item.id);

  return (
    <Link
      href={item.href}
      className={cn(
        "wire-nav-item",
        active && "wire-nav-item--active",
        collapsed && "wire-nav-item--compact",
        manageVisibility && isHiddenForOthers && "opacity-70",
      )}
      onClick={onNavigate}
    >
      <Icon className="size-[15px] shrink-0 opacity-60" aria-hidden />
      <span className={cn(collapsed && "min-w-0 flex-1 truncate")}>{item.label}</span>
      {manageVisibility ? (
        <NavVisibilityToggle
          navId={item.id}
          hidden={isHiddenForOthers}
          collapsed={collapsed}
          onToggle={onToggleHidden}
        />
      ) : null}
    </Link>
  );
}

export function AgentSidebar({
  user: userFromServer,
  showUsersNav: showUsersNavFromServer,
  collapsed = false,
  onToggle,
  onNavigate,
}: {
  user?: User | null;
  showUsersNav?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const user = userFromServer ?? getClientUser();
  const staff = isStaff(user);
  const showAdmin = showUsersNavFromServer ?? canManageUsers(user);
  const topAdmin = isTopAdmin(user);
  const showClassicSwitch = canChooseClassicUi(user);
  const onClassicRoute =
    pathname === "/classic" || pathname.startsWith("/classic/");

  const { hiddenNavIds, toggleHidden } = useSidebarNavVisibility(staff);
  const allItems = buildAgentNavItems({ staff, showAdmin });
  const mainItems = filterNavItemsForViewer(
    allItems.filter((item) => !item.id.startsWith("integration-")),
    hiddenNavIds,
    topAdmin,
  );

  let lastSection: string | undefined;

  return (
    <aside
      className={cn("wire-sidebar flex flex-col", collapsed && "wire-sidebar--collapsed")}
      data-collapsed={collapsed ? "" : undefined}
    >
      {!collapsed ? (
        <div className="wire-shell-col-header wire-shell-col-header--nav flex items-center justify-end px-1">
          {onToggle ? <SidebarCollapseToggle collapsed={false} onToggle={onToggle} /> : null}
        </div>
      ) : null}

      {topAdmin && !collapsed ? (
        <p className="text-muted-foreground border-b border-[var(--gray-border)] px-4 py-2 text-[10px] leading-snug">
          Øje-ikon: skjul menupunkt for alle undtagen topadministrator
        </p>
      ) : null}

      <nav
        className="flex flex-1 flex-col overflow-y-auto py-1"
        aria-label="Hovednavigation"
      >
        {mainItems.map((item) => {
          const showSection = !collapsed && item.section && item.section !== lastSection;
          if (item.section) lastSection = item.section;

          return (
            <div key={item.id}>
              {showSection ? (
                <p className="wire-nav-section">{item.section}</p>
              ) : null}
              <NavRow
                item={item}
                pathname={pathname}
                collapsed={collapsed}
                onNavigate={onNavigate}
                manageVisibility={topAdmin}
                hiddenNavIds={hiddenNavIds}
                onToggleHidden={(navId, hide) => void toggleHidden(navId, hide)}
              />
              {showClassicSwitch && item.href === "/service-desk" ? (
                <div key="classic-ui-switch">
                  {!collapsed ? (
                    <p className="wire-nav-section">Grænseflade</p>
                  ) : null}
                  <SidebarUiModeSwitch
                    targetMode="classic"
                    label="Klassisk grænseflade (TOPdesk)"
                    icon={LayoutGrid}
                    active={onClassicRoute}
                    collapsed={collapsed}
                    onNavigate={onNavigate}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
        {showClassicSwitch && !mainItems.some((item) => item.href === "/service-desk") ? (
          <div>
            {!collapsed ? <p className="wire-nav-section">Grænseflade</p> : null}
            <SidebarUiModeSwitch
              targetMode="classic"
              label="Klassisk grænseflade (TOPdesk)"
              icon={LayoutGrid}
              active={onClassicRoute}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          </div>
        ) : null}
        {staff ? (
          <IntegrationSidebarLinks
            pathname={pathname}
            collapsed={collapsed}
            onNavigate={onNavigate}
            hiddenNavIds={hiddenNavIds}
            isTopAdmin={topAdmin}
            onToggleHidden={(navId, hide) => void toggleHidden(navId, hide)}
          />
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
