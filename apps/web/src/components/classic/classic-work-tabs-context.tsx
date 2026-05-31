"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  recordRecentCard,
  type ClassicRecentCard,
  loadRecentCards,
} from "@/lib/classic-recent-cards";
import {
  CLASSIC_HOME_HREF,
  CLASSIC_HOME_TAB,
  loadWorkTabsState,
  mergeTabs,
  pathnameToTab,
  saveWorkTabsState,
  type ClassicTab,
} from "@/lib/classic-work-tabs";

type ClassicWorkTabsContextValue = Readonly<{
  tabs: ClassicTab[];
  activeTabId: string;
  recentCards: ClassicRecentCard[];
  activateTab: (tabId: string) => void;
  closeTab: (tabId: string) => void;
  closeAllTabs: () => void;
  closeOtherTabs: () => void;
  goHome: () => void;
  refreshRecentCards: () => void;
  updateTicketTab: (payload: {
    ticketId: string;
    ticketNumber: string;
    title: string;
    subtitle: string;
  }) => void;
}>;

const ClassicWorkTabsContext = createContext<ClassicWorkTabsContextValue | null>(
  null,
);

export function useClassicWorkTabs(): ClassicWorkTabsContextValue {
  const ctx = useContext(ClassicWorkTabsContext);
  if (!ctx) {
    throw new Error("useClassicWorkTabs must be used within ClassicWorkTabsProvider");
  }
  return ctx;
}

export function ClassicWorkTabsProvider({
  userId,
  children,
}: {
  userId: string | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [tabs, setTabs] = useState<ClassicTab[]>([CLASSIC_HOME_TAB]);
  const [activeTabId, setActiveTabId] = useState(CLASSIC_HOME_TAB.id);
  const [recentCards, setRecentCards] = useState<ClassicRecentCard[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!userId) {
      setHydrated(true);
      return;
    }
    const stored = loadWorkTabsState(userId);
    if (stored) {
      setTabs(stored.tabs);
      setActiveTabId(stored.activeId);
    }
    setRecentCards(loadRecentCards(userId));
    setHydrated(true);
  }, [userId]);

  useEffect(() => {
    if (!hydrated || !pathname.startsWith("/classic")) return;
    const incoming = pathnameToTab(pathname);
    if (!incoming) return;
    setTabs((prev) => mergeTabs(prev, incoming));
  }, [pathname, hydrated]);

  useEffect(() => {
    if (!hydrated || !pathname.startsWith("/classic")) return;
    const incoming = pathnameToTab(pathname);
    if (!incoming) return;
    setActiveTabId((current) => {
      const match = tabs.find((t) => t.href === incoming.href);
      return match?.id ?? current;
    });
  }, [pathname, tabs, hydrated]);

  useEffect(() => {
    if (!hydrated || !userId) return;
    saveWorkTabsState(userId, tabs, activeTabId);
  }, [tabs, activeTabId, userId, hydrated]);

  const activateTab = useCallback(
    (tabId: string) => {
      const tab = tabs.find((t) => t.id === tabId);
      if (!tab) return;
      setActiveTabId(tabId);
      if (pathname !== tab.href) {
        router.push(tab.href);
      }
    },
    [tabs, pathname, router],
  );

  const closeTab = useCallback(
    (tabId: string) => {
      const tab = tabs.find((t) => t.id === tabId);
      if (!tab?.closable) return;
      const idx = tabs.findIndex((t) => t.id === tabId);
      const nextTabs = tabs.filter((t) => t.id !== tabId);
      setTabs(nextTabs.length ? nextTabs : [CLASSIC_HOME_TAB]);
      if (activeTabId !== tabId) return;
      const neighbour = nextTabs[Math.min(idx, nextTabs.length - 1)] ?? CLASSIC_HOME_TAB;
      setActiveTabId(neighbour.id);
      router.push(neighbour.href);
    },
    [tabs, activeTabId, router],
  );

  const closeAllTabs = useCallback(() => {
    setTabs([CLASSIC_HOME_TAB]);
    setActiveTabId(CLASSIC_HOME_TAB.id);
    router.push(CLASSIC_HOME_HREF);
  }, [router]);

  const closeOtherTabs = useCallback(() => {
    const active = tabs.find((t) => t.id === activeTabId);
    const keep = [CLASSIC_HOME_TAB];
    if (active && active.id !== CLASSIC_HOME_TAB.id) {
      keep.push(active);
    }
    setTabs(keep);
    if (active && active.id !== CLASSIC_HOME_TAB.id) {
      setActiveTabId(active.id);
      router.push(active.href);
    } else {
      setActiveTabId(CLASSIC_HOME_TAB.id);
      router.push(CLASSIC_HOME_HREF);
    }
  }, [tabs, activeTabId, router]);

  const goHome = useCallback(() => {
    setActiveTabId(CLASSIC_HOME_TAB.id);
    router.push(CLASSIC_HOME_HREF);
  }, [router]);

  const refreshRecentCards = useCallback(() => {
    if (!userId) return;
    setRecentCards(loadRecentCards(userId));
  }, [userId]);

  const updateTicketTab = useCallback(
    (payload: {
      ticketId: string;
      ticketNumber: string;
      title: string;
      subtitle: string;
    }) => {
      const href = `/classic/tickets/${payload.ticketId}`;
      const label = `${payload.ticketNumber} ${payload.title}`.trim();
      const short =
        label.length > 42 ? `${label.slice(0, 39).trimEnd()}…` : label;

      setTabs((prev) =>
        mergeTabs(prev, {
          id: `ticket:${payload.ticketId}`,
          href,
          label: short,
          kind: "ticket",
          closable: true,
        }),
      );
      setActiveTabId(`ticket:${payload.ticketId}`);

      if (userId) {
        const next = recordRecentCard(userId, {
          id: payload.ticketId,
          href,
          ticketNumber: payload.ticketNumber,
          title: payload.title,
          subtitle: payload.subtitle,
        });
        setRecentCards(next);
      }
    },
    [userId],
  );

  const value = useMemo(
    () => ({
      tabs,
      activeTabId,
      recentCards,
      activateTab,
      closeTab,
      closeAllTabs,
      closeOtherTabs,
      goHome,
      refreshRecentCards,
      updateTicketTab,
    }),
    [
      tabs,
      activeTabId,
      recentCards,
      activateTab,
      closeTab,
      closeAllTabs,
      closeOtherTabs,
      goHome,
      refreshRecentCards,
      updateTicketTab,
    ],
  );

  return (
    <ClassicWorkTabsContext.Provider value={value}>
      {children}
    </ClassicWorkTabsContext.Provider>
  );
}
