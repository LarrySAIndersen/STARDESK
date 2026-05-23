"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { AgentNavItem } from "@/lib/agent-nav";
import {
  buildDefaultNavLayout,
  groupLayoutBySection,
  mergeNavLayout,
  moveNavEntry,
  readNavLayoutFromStorage,
  type NavLayout,
  type NavSectionId,
  writeNavLayoutToStorage,
} from "@/lib/agent-nav-config";

export const NAV_LAYOUT_CHANGED_EVENT = "stardesk:nav-layout-changed";

export function useNavLayout(
  items: AgentNavItem[],
  options: { includeClassicUi: boolean },
) {
  const { includeClassicUi } = options;
  const defaultLayout = useMemo(
    () => buildDefaultNavLayout(items, { includeClassicUi }),
    [items, includeClassicUi],
  );
  const availableIds = useMemo(() => new Set(defaultLayout.entries.map((entry) => entry.id)), [defaultLayout]);

  const [layout, setLayout] = useState<NavLayout>(defaultLayout);
  const [editMode, setEditMode] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = readNavLayoutFromStorage();
    setLayout(mergeNavLayout(saved, defaultLayout, availableIds));
    setHydrated(true);
  }, [defaultLayout, availableIds]);

  useEffect(() => {
    const onChanged = () => {
      const saved = readNavLayoutFromStorage();
      setLayout(mergeNavLayout(saved, defaultLayout, availableIds));
    };
    window.addEventListener(NAV_LAYOUT_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(NAV_LAYOUT_CHANGED_EVENT, onChanged);
  }, [defaultLayout, availableIds]);

  const persistLayout = useCallback((next: NavLayout) => {
    setLayout(next);
    writeNavLayoutToStorage(next);
    window.dispatchEvent(new CustomEvent(NAV_LAYOUT_CHANGED_EVENT));
  }, []);

  const resetLayout = useCallback(() => {
    persistLayout(defaultLayout);
  }, [defaultLayout, persistLayout]);

  const moveItem = useCallback(
    (draggedId: string, targetSectionId: NavSectionId, beforeId?: string | null) => {
      persistLayout(moveNavEntry(layout, draggedId, targetSectionId, beforeId));
    },
    [layout, persistLayout],
  );

  const grouped = useMemo(
    () => groupLayoutBySection(layout, availableIds),
    [layout, availableIds],
  );

  return {
    layout,
    grouped,
    editMode,
    setEditMode,
    resetLayout,
    moveItem,
    hydrated,
  };
}
