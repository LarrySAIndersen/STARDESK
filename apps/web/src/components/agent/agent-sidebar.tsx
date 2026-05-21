"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid } from "lucide-react";

import { CollapsibleNavSection } from "@/components/agent/collapsible-nav-section";
import { NavVisibilityEye } from "@/components/agent/nav-visibility-eye";
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

function sectionId(label: string): string {
  return label.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function groupNavItems(items: AgentNavItem[]): { unsectioned: AgentNavItem[]; sections: { label: string; items: AgentNavItem[] }[] } {
  const unsectioned: AgentNavItem[] = [];
  const sectionMap = new Map<string, AgentNavItem[]>();

  for (const item of items) {
    if (!item.section) {
      unsectioned.push(item);
      continue;
    }
    const list = sectionMap.get(item.section) ?? [];
    list.push(item);
    sectionMap.set(item.section, list);
  }

  return {
    unsectioned,
    sections: [...sectionMap.entries()].map(([label, sectionItems]) => ({
      label,
      items: sectionItems,
    })),
  };
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
        manageVisibility && isHiddenForOthers && "opacity-80",
      )}
      onClick={onNavigate}
    >
      <Icon className="size-[15px] shrink-0 opacity-60" aria-hidden />
      <span className={cn(collapsed && "min-w-0 flex-1 truncate")}>{item.label}</span>
      {manageVisibility ? (
        <NavVisibilityEye
          hidden={isHiddenForOthers}
          collapsed={collapsed}
          onToggle={() => onToggleHidden(item.id, !isHiddenForOthers)}
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

  const { hiddenNavIds, error, toggleHidden } = useSidebarNavVisibility(staff);
  const allItems = buildAgentNavItems({ staff, showAdmin });
  const mainItems = filterNavItemsForViewer(
    allItems.filter((item) => !item.id.startsWith("integration-")),
    hiddenNavIds,
    topAdmin,
  );
  const { unsectioned, sections } = groupNavItems(mainItems);

  const renderClassicSwitch = (afterServiceDesk: boolean) => {
    if (!showClassicSwitch) return null;
    const hasServiceDesk = mainItems.some((item) => item.href === "/service-desk");
    if (afterServiceDesk && !hasServiceDesk) return null;
    if (!afterServiceDesk && hasServiceDesk) return null;

    return (
      <div key="classic-ui-switch">
        <CollapsibleNavSection
          sectionId="graenseflade"
          label="Grænseflade"
          collapsed={collapsed}
          defaultOpen
        >
          <SidebarUiModeSwitch
            targetMode="classic"
            label="Klassisk grænseflade (TOPdesk)"
            icon={LayoutGrid}
            active={onClassicRoute}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        </CollapsibleNavSection>
      </div>
    );
  };

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
          <span className="text-[#1a7a44] font-semibold">Grønt øje</span> = synlig for alle.{" "}
          <span className="text-[#c41e2a] font-semibold">Rødt øje</span> = skjult for alle undtagen
          topadministrator. Klik sektionsoverskrift for at folde ud/ind.
        </p>
      ) : null}

      {error && !collapsed ? (
        <p className="border-b border-[var(--gray-border)] px-4 py-2 text-[10px] text-[#c41e2a]" role="alert">
          {error}
        </p>
      ) : null}

      <nav
        className="flex flex-1 flex-col overflow-y-auto py-1"
        aria-label="Hovednavigation"
      >
        {unsectioned.map((item) => (
          <div key={item.id}>
            <NavRow
              item={item}
              pathname={pathname}
              collapsed={collapsed}
              onNavigate={onNavigate}
              manageVisibility={topAdmin}
              hiddenNavIds={hiddenNavIds}
              onToggleHidden={(navId, hide) => void toggleHidden(navId, hide)}
            />
            {showClassicSwitch && item.href === "/service-desk"
              ? renderClassicSwitch(true)
              : null}
          </div>
        ))}

        {showClassicSwitch && !mainItems.some((item) => item.href === "/service-desk")
          ? renderClassicSwitch(false)
          : null}

        {sections.map((section) => (
          <CollapsibleNavSection
            key={section.label}
            sectionId={sectionId(section.label)}
            label={section.label}
            collapsed={collapsed}
            defaultOpen
          >
            {section.items.map((item) => (
              <NavRow
                key={item.id}
                item={item}
                pathname={pathname}
                collapsed={collapsed}
                onNavigate={onNavigate}
                manageVisibility={topAdmin}
                hiddenNavIds={hiddenNavIds}
                onToggleHidden={(navId, hide) => void toggleHidden(navId, hide)}
              />
            ))}
          </CollapsibleNavSection>
        ))}

        {staff ? (
          <CollapsibleNavSection
            sectionId="integration"
            label="Integration"
            collapsed={collapsed}
            defaultOpen
          >
            <IntegrationSidebarLinks
              pathname={pathname}
              collapsed={collapsed}
              onNavigate={onNavigate}
              hiddenNavIds={hiddenNavIds}
              isTopAdmin={topAdmin}
              onToggleHidden={(navId, hide) => void toggleHidden(navId, hide)}
              showSectionHeader={false}
            />
          </CollapsibleNavSection>
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
