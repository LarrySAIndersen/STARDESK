import { CLASSIC_MODULES } from "@/lib/classic-modules";

export const CLASSIC_HOME_HREF = "/classic";

export type ClassicTabKind = "home" | "list" | "ticket" | "page";

export type ClassicTab = {
  id: string;
  href: string;
  label: string;
  kind: ClassicTabKind;
  closable: boolean;
};

export const CLASSIC_HOME_TAB: ClassicTab = {
  id: "home",
  href: CLASSIC_HOME_HREF,
  label: "Forside",
  kind: "home",
  closable: false,
};

const STATIC_PAGES: { href: string; label: string }[] = [
  { href: "/classic/my-work", label: "Mit arbejde" },
];

function ticketTabId(ticketId: string): string {
  return `ticket:${ticketId}`;
}

export function pathnameToTab(pathname: string): ClassicTab | null {
  if (pathname === CLASSIC_HOME_HREF) {
    return { ...CLASSIC_HOME_TAB };
  }

  const module = CLASSIC_MODULES.find((m) => m.href === pathname);
  if (module) {
    return {
      id: `list:${module.id}`,
      href: module.href,
      label: module.label,
      kind: "list",
      closable: true,
    };
  }

  const page = STATIC_PAGES.find((p) => p.href === pathname);
  if (page) {
    return {
      id: `page:${page.href}`,
      href: page.href,
      label: page.label,
      kind: "page",
      closable: true,
    };
  }

  const ticketMatch = /^\/classic\/tickets\/([^/]+)$/.exec(pathname);
  if (ticketMatch) {
    const ticketId = ticketMatch[1];
    return {
      id: ticketTabId(ticketId),
      href: pathname,
      label: "Sag",
      kind: "ticket",
      closable: true,
    };
  }

  return null;
}

export function mergeTabs(existing: ClassicTab[], incoming: ClassicTab): ClassicTab[] {
  const idx = existing.findIndex((t) => t.href === incoming.href);
  if (idx >= 0) {
    const next = [...existing];
    next[idx] = { ...next[idx], ...incoming, id: next[idx].id };
    return next;
  }
  if (incoming.kind === "home") {
    return existing;
  }
  return [...existing, incoming];
}

const TABS_STORAGE_PREFIX = "stardesk-classic-work-tabs";

export function workTabsStorageKey(userId: string): string {
  return `${TABS_STORAGE_PREFIX}:${userId}`;
}

export function loadWorkTabsState(userId: string): {
  tabs: ClassicTab[];
  activeId: string;
} | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(workTabsStorageKey(userId));
    if (!raw) return null;
    const data = JSON.parse(raw) as { tabs?: ClassicTab[]; activeId?: string };
    if (!Array.isArray(data.tabs) || data.tabs.length === 0) return null;
    const hasHome = data.tabs.some((t) => t.id === CLASSIC_HOME_TAB.id);
    const tabs = hasHome ? data.tabs : [CLASSIC_HOME_TAB, ...data.tabs];
    return {
      tabs,
      activeId: data.activeId ?? tabs[tabs.length - 1].id,
    };
  } catch {
    return null;
  }
}

export function saveWorkTabsState(
  userId: string,
  tabs: ClassicTab[],
  activeId: string,
): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(
    workTabsStorageKey(userId),
    JSON.stringify({ tabs, activeId }),
  );
}
