"use client";

import { usePathname, useRouter } from "next/navigation";
import { GripVertical, LayoutGrid } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type DragEvent, type ReactNode } from "react";

import { CollapsibleNavSection } from "@/components/agent/collapsible-nav-section";
import { NavVisibilityEye } from "@/components/agent/nav-visibility-eye";
import { IntegrationSidebarLinks } from "@/components/integrations/integration-sidebar-links";
import { SidebarCollapseToggle } from "@/components/sidebar-collapse-toggle";
import { SidebarUiModeSwitch } from "@/components/sidebar-ui-mode-switch";
import { Button } from "@/components/ui/button";
import { useNavLayout } from "@/hooks/use-nav-layout";
import { useSidebarNavVisibility } from "@/hooks/use-sidebar-nav-visibility";
import {
  buildAgentNavItems,
  CLASSIC_UI_NAV_ID,
  filterNavItemsForViewer,
  type AgentNavItem,
} from "@/lib/agent-nav";
import {
  NAV_DRAG_MIME,
  NAV_SECTIONS,
  type NavLayoutEntry,
  type NavSectionId,
} from "@/lib/agent-nav-config";
import { canManageUsers, getClientUser, hasAgentShellAccess, isStaff, isTopAdmin } from "@/lib/auth";
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

function readDraggedNavId(dataTransfer: DataTransfer): string {
  return dataTransfer.getData(NAV_DRAG_MIME) || dataTransfer.getData("text/plain") || "";
}

function isValidNavHref(href: string): boolean {
  return href.startsWith("/") && href !== "/#";
}

function NavRow({
  item,
  pathname,
  collapsed,
  onNavigate,
  manageVisibility,
  hiddenNavIds,
  onToggleHidden,
  editMode,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  dragOver,
}: {
  item: AgentNavItem;
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
  manageVisibility: boolean;
  hiddenNavIds: string[];
  onToggleHidden: (navId: string, hide: boolean) => void;
  editMode?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDragOver?: (event: DragEvent<HTMLElement>) => void;
  onDrop?: (event: DragEvent<HTMLElement>) => void;
  dragOver?: boolean;
}) {
  const router = useRouter();
  const Icon = item.icon;
  const active = isActive(pathname, item.href);
  const isHiddenForOthers = hiddenNavIds.includes(item.id);
  const href = isValidNavHref(item.href) ? item.href : null;

  const content = collapsed ? (
    <Icon className="size-[18px] shrink-0 opacity-70" aria-hidden />
  ) : (
    <>
      {editMode ? (
        <GripVertical className="text-muted-foreground size-3.5 shrink-0 opacity-70" aria-hidden />
      ) : (
        <Icon className="size-[15px] shrink-0 opacity-60" aria-hidden />
      )}
      <span className="wire-nav-item__label min-w-0 flex-1 truncate">{item.label}</span>
      {manageVisibility && !editMode ? (
        <NavVisibilityEye
          hidden={isHiddenForOthers}
          collapsed={collapsed}
          onToggle={() => onToggleHidden(item.id, !isHiddenForOthers)}
        />
      ) : null}
    </>
  );

  const className = cn(
    "wire-nav-item",
    active && !editMode && "wire-nav-item--active",
    collapsed && "wire-nav-item--compact",
    manageVisibility && isHiddenForOthers && "opacity-80",
    editMode && "wire-nav-item--editable cursor-grab active:cursor-grabbing",
    dragOver && "wire-nav-item--drag-over",
  );

  if (editMode) {
    return (
      <div
        role="listitem"
        draggable
        className={className}
        onDragStart={(event) => {
          event.dataTransfer.setData(NAV_DRAG_MIME, item.id);
          event.dataTransfer.setData("text/plain", item.id);
          event.dataTransfer.effectAllowed = "move";
          onDragStart?.();
        }}
        onDragEnd={() => onDragEnd?.()}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        {content}
      </div>
    );
  }

  if (!href) {
    return null;
  }

  return (
    <a
      href={href}
      className={className}
      title={collapsed ? item.label : undefined}
      aria-label={collapsed ? item.label : undefined}
      onClick={(event) => {
        event.preventDefault();
        onNavigate?.();
        router.push(href);
      }}
    >
      {content}
    </a>
  );
}

function NavSectionDropZone({
  sectionId,
  editMode,
  draggingId,
  onMove,
  children,
}: {
  sectionId: NavSectionId;
  editMode: boolean;
  draggingId: string | null;
  onMove: (draggedId: string, targetSectionId: NavSectionId, beforeId?: string | null) => void;
  children: ReactNode;
}) {
  const [dragOver, setDragOver] = useState(false);

  if (!editMode) {
    return <>{children}</>;
  }

  return (
    <div
      className={cn("wire-nav-section-drop", dragOver && "wire-nav-section-drop--active")}
      onDragOver={(event) => {
        if (!draggingId) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragOver(false);
        const draggedId = readDraggedNavId(event.dataTransfer);
        if (!draggedId) return;
        onMove(draggedId, sectionId, null);
      }}
    >
      {children}
    </div>
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
  const agentShellUser = hasAgentShellAccess(user);
  const showAdmin = showUsersNavFromServer ?? canManageUsers(user);
  const topAdmin = isTopAdmin(user);
  const showClassicSwitch = canChooseClassicUi(user);
  const onClassicRoute =
    pathname === "/classic" || pathname.startsWith("/classic/");

  const { hiddenNavIds, error, toggleHidden } = useSidebarNavVisibility(staff);
  const allItems = useMemo(
    () =>
      buildAgentNavItems({
        staff: agentShellUser,
        showAdmin,
        showForbedringer: staff,
      }),
    [agentShellUser, showAdmin, staff],
  );
  const visibleItems = useMemo(
    () => filterNavItemsForViewer(allItems, hiddenNavIds, topAdmin),
    [allItems, hiddenNavIds, topAdmin],
  );
  const itemMap = useMemo(
    () => new Map(visibleItems.map((item) => [item.id, item])),
    [visibleItems],
  );

  const {
    grouped,
    editMode,
    setEditMode,
    resetLayout,
    moveItem,
    hydrated,
  } = useNavLayout(visibleItems, { includeClassicUi: showClassicSwitch });

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  useEffect(() => {
    if (collapsed && editMode) {
      setEditMode(false);
    }
  }, [collapsed, editMode, setEditMode]);

  const handleDropOnItem = useCallback(
    (targetId: string, targetSectionId: NavSectionId) => (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const draggedId = readDraggedNavId(event.dataTransfer);
      setDragOverId(null);
      setDraggingId(null);
      if (!draggedId || draggedId === targetId) return;
      moveItem(draggedId, targetSectionId, targetId);
    },
    [moveItem],
  );

  const renderClassicSwitch = () => (
    <SidebarUiModeSwitch
      key={CLASSIC_UI_NAV_ID}
      targetMode="classic"
      label="Klassisk grænseflade (TOPdesk)"
      icon={LayoutGrid}
      active={onClassicRoute}
      collapsed={collapsed}
      onNavigate={onNavigate}
    />
  );

  const renderClassicUiEditor = (sectionId: NavSectionId) => (
    <div
      key={CLASSIC_UI_NAV_ID}
      role="listitem"
      draggable
      className={cn(
        "wire-nav-item wire-nav-item--editable cursor-grab active:cursor-grabbing",
        dragOverId === CLASSIC_UI_NAV_ID && "wire-nav-item--drag-over",
      )}
      onDragStart={(event) => {
        event.dataTransfer.setData(NAV_DRAG_MIME, CLASSIC_UI_NAV_ID);
        event.dataTransfer.setData("text/plain", CLASSIC_UI_NAV_ID);
        event.dataTransfer.effectAllowed = "move";
        setDraggingId(CLASSIC_UI_NAV_ID);
      }}
      onDragEnd={() => {
        setDraggingId(null);
        setDragOverId(null);
      }}
      onDragOver={(event) => {
        if (!draggingId || draggingId === CLASSIC_UI_NAV_ID) return;
        event.preventDefault();
        event.stopPropagation();
        setDragOverId(CLASSIC_UI_NAV_ID);
      }}
      onDrop={handleDropOnItem(CLASSIC_UI_NAV_ID, sectionId)}
    >
      <GripVertical className="text-muted-foreground size-3.5 shrink-0 opacity-70" aria-hidden />
      <span>Klassisk grænseflade (TOPdesk)</span>
    </div>
  );

  const renderEntry = (entry: NavLayoutEntry, sectionId: NavSectionId) => {
    if (entry.id === CLASSIC_UI_NAV_ID) {
      if (!showClassicSwitch) return null;
      return editMode ? renderClassicUiEditor(sectionId) : renderClassicSwitch();
    }

    const item = itemMap.get(entry.id);
    if (!item) return null;

    if (item.id.startsWith("integration-") && !editMode) {
      return null;
    }

    return (
      <NavRow
        key={entry.id}
        item={item}
        pathname={pathname}
        collapsed={collapsed}
        onNavigate={onNavigate}
        manageVisibility={topAdmin}
        hiddenNavIds={hiddenNavIds}
        onToggleHidden={(navId, hide) => void toggleHidden(navId, hide)}
        editMode={editMode}
        dragOver={dragOverId === entry.id}
        onDragStart={() => setDraggingId(entry.id)}
        onDragEnd={() => {
          setDraggingId(null);
          setDragOverId(null);
        }}
        onDragOver={(event) => {
          if (!editMode || !draggingId || draggingId === entry.id) return;
          event.preventDefault();
          event.stopPropagation();
          event.dataTransfer.dropEffect = "move";
          setDragOverId(entry.id);
        }}
        onDrop={handleDropOnItem(entry.id, sectionId)}
      />
    );
  };

  const renderSectionContent = (sectionId: NavSectionId, entries: NavLayoutEntry[]) => {
    const integrationIds = entries
      .map((entry) => entry.id)
      .filter((id) => id.startsWith("integration-"));

    return (
      <NavSectionDropZone
        sectionId={sectionId}
        editMode={editMode}
        draggingId={draggingId}
        onMove={moveItem}
      >
        {entries.map((entry) => renderEntry(entry, sectionId))}

        {integrationIds.length > 0 && !editMode ? (
          <IntegrationSidebarLinks
            pathname={pathname}
            collapsed={collapsed}
            onNavigate={onNavigate}
            hiddenNavIds={hiddenNavIds}
            isTopAdmin={topAdmin}
            onToggleHidden={(navId, hide) => void toggleHidden(navId, hide)}
            showSectionHeader={false}
            orderedIds={integrationIds}
          />
        ) : null}
      </NavSectionDropZone>
    );
  };

  const sectionLabel = (sectionId: NavSectionId) =>
    NAV_SECTIONS.find((section) => section.id === sectionId)?.label;

  return (
    <aside
      className={cn(
        "wire-sidebar wire-sidebar--container flex flex-col",
        collapsed && "wire-sidebar--collapsed",
      )}
      data-collapsed={collapsed ? "" : undefined}
    >
      <div
        className={cn(
          "wire-shell-col-header wire-shell-col-header--nav flex shrink-0 items-center px-1",
          collapsed ? "justify-center py-1" : "justify-end",
        )}
      >
        {onToggle ? <SidebarCollapseToggle collapsed={collapsed} onToggle={onToggle} /> : null}
      </div>

      {topAdmin && !collapsed && !editMode ? (
        <div className="wire-sidebar-nav-legend border-b border-[var(--gray-border)]">
          <p className="wire-sidebar-nav-legend--wide text-muted-foreground px-4 py-2 text-[10px] leading-snug">
            <span className="text-[#1a7a44] font-semibold">Grønt øje</span> = synlig for alle.{" "}
            <span className="text-[#c41e2a] font-semibold">Rødt øje</span> = skjult for alle undtagen
            topadministrator. Klik sektionsoverskrift for at folde ud/ind.
          </p>
          <ul className="wire-sidebar-nav-legend--compact text-muted-foreground space-y-1.5 px-3 py-2.5 text-[10px] leading-snug">
            <li className="flex items-start gap-2">
              <span className="text-[#1a7a44] mt-0.5 shrink-0 font-bold" aria-hidden>
                ●
              </span>
              <span>Synlig for alle</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#c41e2a] mt-0.5 shrink-0 font-bold" aria-hidden>
                ●
              </span>
              <span>Kun topadmin</span>
            </li>
            <li className="text-muted-foreground/90 pl-4 text-[9px]">Klik sektion · fold ud</li>
          </ul>
        </div>
      ) : null}

      {editMode && !collapsed ? (
        <p className="text-muted-foreground border-b border-[var(--gray-border)] bg-muted/30 px-4 py-2 text-[10px] leading-snug">
          Træk menupunkter mellem sektioner for at tilpasse menuen.
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
        {hydrated
          ? grouped.map((section) => {
              const label = sectionLabel(section.sectionId);
              if (!label) {
                return (
                  <div key={section.sectionId}>
                    {renderSectionContent(section.sectionId, section.entries)}
                  </div>
                );
              }
              return (
                <CollapsibleNavSection
                  key={section.sectionId}
                  sectionId={section.sectionId}
                  label={label}
                  collapsed={collapsed}
                  defaultOpen
                >
                  {renderSectionContent(section.sectionId, section.entries)}
                </CollapsibleNavSection>
              );
            })
          : null}
      </nav>

      {!collapsed && showAdmin ? (
        <footer className="wire-sidebar-footer border-t border-[var(--gray-border)] px-3 py-2">
          {editMode ? (
            <div className="flex flex-col gap-2">
              <Button type="button" size="sm" className="w-full" onClick={() => setEditMode(false)}>
                Færdig
              </Button>
              <Button type="button" size="sm" variant="outline" className="w-full" onClick={resetLayout}>
                Nulstil menu
              </Button>
            </div>
          ) : (
            <Button type="button" size="sm" variant="outline" className="w-full" onClick={() => setEditMode(true)}>
              Tilpas menu
            </Button>
          )}
        </footer>
      ) : null}

    </aside>
  );
}
