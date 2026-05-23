"use client";

import { formatSlaCountdownValue } from "@/lib/sla-format";
import { SLA_TICK_INTERVAL_MS, useSlaRemaining } from "@/lib/use-sla-remaining";
import type { LongestOpenTicket } from "@/types/dashboard";

export function LongestTicketSla({ ticket }: { ticket: LongestOpenTicket }) {
  const remaining = useSlaRemaining({
    status: "in_progress",
    resolutionDueAt: ticket.resolution_due_at,
    slaRemainingSeconds: ticket.sla_remaining_seconds,
    tickIntervalMs: SLA_TICK_INTERVAL_MS.detail,
  });

  if (ticket.sla_breached === true) {
    const secs = remaining ?? ticket.sla_remaining_seconds ?? 0;
    return (
      <span className="text-star-red font-semibold">
        {secs < 0 ? formatSlaCountdownValue(secs, true) : "SLA overskredet"}
      </span>
    );
  }

  if (remaining != null && remaining > 0) {
    return <span className="text-star-navy font-medium">{formatSlaCountdownValue(remaining, false)} tilbage</span>;
  }

  if (ticket.resolution_due_at) {
    return (
      <span className="text-star-navy font-medium">
        Forfald{" "}
        {new Intl.DateTimeFormat("da-DK", {
          dateStyle: "short",
          timeStyle: "short",
          timeZone: "Europe/Copenhagen",
        }).format(new Date(ticket.resolution_due_at))}
      </span>
    );
  }

  return null;
}
