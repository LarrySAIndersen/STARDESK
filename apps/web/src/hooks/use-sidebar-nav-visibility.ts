"use client";

import { useCallback, useEffect, useState } from "react";

import { apiGet, apiPut } from "@/lib/api";

export function useSidebarNavVisibility(enabled: boolean) {
  const [hiddenNavIds, setHiddenNavIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(enabled);

  const reload = useCallback(async () => {
    if (!enabled) {
      setHiddenNavIds([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiGet<{ hidden_nav_ids: string[] }>(
        "/api/v1/platform/sidebar-nav-visibility",
      );
      setHiddenNavIds(data.hidden_nav_ids ?? []);
    } catch {
      setHiddenNavIds([]);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const toggleHidden = useCallback(
    async (navId: string, hide: boolean) => {
      const next = hide
        ? [...new Set([...hiddenNavIds, navId])]
        : hiddenNavIds.filter((id) => id !== navId);
      const data = await apiPut<{ hidden_nav_ids: string[] }>(
        "/api/v1/platform/sidebar-nav-visibility",
        { hidden_nav_ids: next },
      );
      setHiddenNavIds(data.hidden_nav_ids);
    },
    [hiddenNavIds],
  );

  return { hiddenNavIds, loading, reload, toggleHidden };
}
