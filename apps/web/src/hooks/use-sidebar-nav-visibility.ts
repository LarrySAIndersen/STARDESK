"use client";

import { useCallback, useEffect, useState } from "react";

import { apiGet, apiPut } from "@/lib/api";

export const NAV_VISIBILITY_CHANGED_EVENT = "stardesk:nav-visibility-changed";

export function useSidebarNavVisibility(enabled: boolean) {
  const [hiddenNavIds, setHiddenNavIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!enabled) {
      setHiddenNavIds([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
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

  useEffect(() => {
    const onChanged = () => {
      void reload();
    };
    window.addEventListener(NAV_VISIBILITY_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(NAV_VISIBILITY_CHANGED_EVENT, onChanged);
  }, [reload]);

  const toggleHidden = useCallback(
    async (navId: string, hide: boolean) => {
      const previous = hiddenNavIds;
      const next = hide
        ? [...new Set([...hiddenNavIds, navId])]
        : hiddenNavIds.filter((id) => id !== navId);
      setHiddenNavIds(next);
      setError(null);
      try {
        const data = await apiPut<{ hidden_nav_ids: string[] }>(
          "/api/v1/platform/sidebar-nav-visibility",
          { hidden_nav_ids: next },
        );
        setHiddenNavIds(data.hidden_nav_ids ?? next);
        window.dispatchEvent(new CustomEvent(NAV_VISIBILITY_CHANGED_EVENT));
      } catch (err) {
        setHiddenNavIds(previous);
        const message =
          err instanceof Error ? err.message : "Kunne ikke gemme menupunkt-synlighed";
        setError(message);
      }
    },
    [hiddenNavIds],
  );

  return { hiddenNavIds, loading, error, reload, toggleHidden };
}
