"use client";

import { useCallback, useEffect, useState } from "react";

import { SIDEBAR_COLLAPSED_STORAGE_KEY } from "@/lib/shell-layout";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function writeCollapsed(value: boolean): void {
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(value));
  } catch {
    // ignore quota / private mode
  }
}

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setCollapsed(readCollapsed());
    setHydrated(true);
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      writeCollapsed(next);
      return next;
    });
  }, []);

  const setCollapsedPersisted = useCallback((value: boolean) => {
    writeCollapsed(value);
    setCollapsed(value);
  }, []);

  return {
    /** False until client hydration — avoids layout flash from SSR. */
    collapsed: hydrated ? collapsed : false,
    toggle,
    setCollapsed: setCollapsedPersisted,
    hydrated,
  };
}
