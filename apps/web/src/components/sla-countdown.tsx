"use client";

import { cn } from "@/lib/utils";
import {
  formatSlaCountdownValue,
  slaCountdownLabel,
} from "@/lib/sla-format";
import {
  SLA_TICK_INTERVAL_MS,
  useSlaRemaining,
} from "@/lib/use-sla-remaining";

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
  /** List/kanban: smaller chip + 30s tick interval. */
  compact?: boolean;
  className?: string;
}) {
  const tickIntervalMs = compact
    ? SLA_TICK_INTERVAL_MS.list
    : SLA_TICK_INTERVAL_MS.detail;

  const remaining = useSlaRemaining({
    status,
    resolutionDueAt,
    slaRemainingSeconds,
    tickIntervalMs,
  });

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
  const display =
    remaining == null ? "—" : formatSlaCountdownValue(remaining, breached);

  return (
    <span
      className={cn(
        "inline-flex flex-col gap-0.5 rounded-md border px-2 py-1 font-mono text-xs tabular-nums",
        breached && "border-red-300 bg-red-50 text-red-800",
        dueSoon && !breached && "border-amber-300 bg-amber-50 text-amber-900",
        !breached &&
          !dueSoon &&
          "border-primary/20 bg-primary/10 text-foreground dark:border-primary/30 dark:bg-primary/15",
        compact && "px-1.5 py-0.5",
        className,
      )}
      aria-live="polite"
    >
      <span className="text-[10px] font-sans font-medium tracking-wide uppercase">
        {label}
      </span>
      <span className={cn("font-semibold", compact && "text-[11px]")}>{display}</span>
    </span>
  );
}
