"use client";

import { useEffect, useRef, useState } from "react";

import { computeRemainingSeconds } from "@/lib/sla-format";

const CLOSED_STATUSES = new Set(["resolved", "closed", "cancelled"]);

/** Detail views: 1s. List/kanban cells: 30s (many timers; sub-minute SLA still visible). */
export const SLA_TICK_INTERVAL_MS = {
  detail: 1000,
  list: 30_000,
} as const;

function tickRemaining(
  resolutionDueAt: string | null | undefined,
  slaRemainingSeconds: number | null | undefined,
  anchorMs: number,
): number | null {
  if (resolutionDueAt) {
    return computeRemainingSeconds(resolutionDueAt, null);
  }
  if (slaRemainingSeconds != null) {
    const elapsed = Math.floor((Date.now() - anchorMs) / 1000);
    return slaRemainingSeconds - elapsed;
  }
  return null;
}

export function useSlaRemaining({
  status,
  resolutionDueAt,
  slaRemainingSeconds,
  tickIntervalMs = SLA_TICK_INTERVAL_MS.detail,
}: {
  status: string;
  resolutionDueAt?: string | null;
  slaRemainingSeconds?: number | null;
  tickIntervalMs?: number;
}): number | null {
  const anchorRef = useRef(Date.now());
  const [remaining, setRemaining] = useState<number | null>(() =>
    tickRemaining(resolutionDueAt, slaRemainingSeconds, anchorRef.current),
  );

  useEffect(() => {
    anchorRef.current = Date.now();
    setRemaining(tickRemaining(resolutionDueAt, slaRemainingSeconds, anchorRef.current));

    if (CLOSED_STATUSES.has(status)) {
      return;
    }

    const id = window.setInterval(() => {
      setRemaining(tickRemaining(resolutionDueAt, slaRemainingSeconds, anchorRef.current));
    }, tickIntervalMs);

    return () => window.clearInterval(id);
  }, [resolutionDueAt, slaRemainingSeconds, status, tickIntervalMs]);

  return CLOSED_STATUSES.has(status) ? null : remaining;
}
