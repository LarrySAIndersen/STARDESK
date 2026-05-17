"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import {
  computeRemainingSeconds,
  formatSlaDuration,
  slaCountdownLabel,
} from "@/lib/sla-format";

const CLOSED_STATUSES = new Set(["resolved", "closed", "cancelled"]);

export function SlaCountdown({
  status,
  resolutionDueAt,
  slaRemainingSeconds,
  slaBreached,
  compact = false,
  className,
}: {
  status: string;
  resolutionDueAt?: string | null;
  slaRemainingSeconds?: number | null;
  slaBreached?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const anchorRef = useRef(Date.now());
  const [remaining, setRemaining] = useState<number | null>(() =>
    computeRemainingSeconds(resolutionDueAt, slaRemainingSeconds),
  );

  useEffect(() => {
    anchorRef.current = Date.now();
    setRemaining(computeRemainingSeconds(resolutionDueAt, slaRemainingSeconds));
    if (CLOSED_STATUSES.has(status)) {
      return;
    }
    const id = window.setInterval(() => {
      if (resolutionDueAt) {
        setRemaining(
          Math.floor((new Date(resolutionDueAt).getTime() - Date.now()) / 1000),
        );
        return;
      }
      if (slaRemainingSeconds != null) {
        const elapsed = Math.floor((Date.now() - anchorRef.current) / 1000);
        setRemaining(slaRemainingSeconds - elapsed);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [resolutionDueAt, slaRemainingSeconds, status]);

  if (CLOSED_STATUSES.has(status)) {
    return (
      <span className={cn("text-muted-foreground text-xs", className)}>SLA afsluttet</span>
    );
  }

  if (remaining == null && !resolutionDueAt) {
    return <span className={cn("text-muted-foreground text-xs", className)}>—</span>;
  }

  const breached = slaBreached ?? (remaining != null && remaining < 0);
  const dueSoon = !breached && remaining != null && remaining <= 3600;
  const label = slaCountdownLabel(remaining, breached, status);
  const display = remaining == null ? "—" : formatSlaDuration(remaining);

  return (
    <span
      className={cn(
        "inline-flex flex-col gap-0.5 rounded-md border px-2 py-1 font-mono text-xs tabular-nums",
        breached && "border-red-300 bg-red-50 text-red-800",
        dueSoon && !breached && "border-amber-300 bg-amber-50 text-amber-900",
        !breached && !dueSoon && "border-star-navy/15 bg-star-navy/5 text-star-navy",
        compact && "px-1.5 py-0.5",
        className,
      )}
      aria-live="polite"
    >
      <span className="text-[10px] font-sans font-medium tracking-wide uppercase">
        {label}
      </span>
      <span className={cn("font-semibold", compact && "text-[11px]")}>
        {breached ? `+${display}` : display}
      </span>
    </span>
  );
}
