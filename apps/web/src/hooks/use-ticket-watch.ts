"use client";

import { fireAndForget } from "@/lib/fire-and-forget";

import { useCallback, useEffect, useMemo, useState } from "react";

import { apiDelete, apiGet, apiPutNoContent } from "@/lib/api";

export const TICKET_WATCH_CHANGED_EVENT = "stardesk:ticket-watch-changed";

export type TicketWatchSummaryRow = {
  ticket_id: string;
  watching: boolean;
};

export function useTicketWatch(ticketIds: string[]) {
  const [watchingById, setWatchingById] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(ticketIds.length > 0);

  const stableKey = useMemo(() => [...new Set(ticketIds)].sort().join(","), [ticketIds]);

  const reload = useCallback(async () => {
    const ids = stableKey.split(",").filter(Boolean);
    if (ids.length === 0) {
      setWatchingById({});
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await apiGet<TicketWatchSummaryRow[]>(
        `/api/v1/personal/ticket-watch/summary?ticket_ids=${encodeURIComponent(ids.join(","))}`,
      );
      const next: Record<string, boolean> = {};
      for (const row of rows) {
        next[row.ticket_id] = row.watching;
      }
      setWatchingById(next);
    } catch {
      setWatchingById({});
    } finally {
      setLoading(false);
    }
  }, [stableKey]);

  useEffect(() => {
    fireAndForget(reload());
  }, [reload]);

  useEffect(() => {
    const onChanged = () => {
      fireAndForget(reload());
    };
    window.addEventListener(TICKET_WATCH_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(TICKET_WATCH_CHANGED_EVENT, onChanged);
  }, [reload]);

  const toggleWatch = useCallback(
    async (ticketId: string) => {
      const wasWatching = watchingById[ticketId] ?? false;
      setWatchingById((prev) => ({ ...prev, [ticketId]: !wasWatching }));
      try {
        if (wasWatching) {
          await apiDelete(`/api/v1/personal/tickets/${ticketId}/watch`);
        } else {
          await apiPutNoContent(`/api/v1/personal/tickets/${ticketId}/watch`);
        }
        window.dispatchEvent(new CustomEvent(TICKET_WATCH_CHANGED_EVENT));
      } catch {
        setWatchingById((prev) => ({ ...prev, [ticketId]: wasWatching }));
      }
    },
    [watchingById],
  );

  return { watchingById, loading, toggleWatch, reload };
}
