import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import type { TicketDetail } from "@/types/ticket";

const STEPS = [
  { key: "created", label: "Oprettet", statuses: ["new"] },
  { key: "assigned", label: "Tildelt", statuses: ["assigned"] },
  { key: "in_progress", label: "I arbejde", statuses: ["in_progress", "on_hold", "pending"] },
  { key: "resolved", label: "Løst", statuses: ["resolved"] },
  { key: "closed", label: "Lukket", statuses: ["closed", "cancelled"] },
] as const;

function stepIndexForStatus(status: string): number {
  if (status === "cancelled") return 4;
  const idx = STEPS.findIndex((step) =>
    (step.statuses as readonly string[]).includes(status),
  );
  return idx >= 0 ? idx : 0;
}

function stepReached(currentIndex: number, stepIndex: number): boolean {
  return currentIndex >= stepIndex;
}

function stepTimestamp(
  ticket: TicketDetail,
  stepKey: (typeof STEPS)[number]["key"],
): string | null {
  const ts = ticket.timestamps;
  if (!ts) return null;
  switch (stepKey) {
    case "created":
      return ts.created_at;
    case "assigned":
      return ts.assigned_at;
    case "in_progress":
      return ts.in_progress_at ?? ts.first_response_at;
    case "resolved":
      return ts.resolved_at;
    case "closed":
      return ts.closed_at ?? ts.cancelled_at;
    default:
      return null;
  }
}

function formatShort(iso: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function StatusTimeline({ ticket }: { ticket: TicketDetail }) {
  const current = stepIndexForStatus(ticket.status);

  return (
    <ol
      className="portal-v2-timeline flex flex-col gap-0 sm:flex-row sm:items-start sm:justify-between"
      aria-label="Sagsforløb"
    >
      {STEPS.map((step, index) => {
        const reached = stepReached(current, index);
        const active = current === index;
        const ts = stepTimestamp(ticket, step.key);

        return (
          <li
            key={step.key}
            className={cn(
              "portal-v2-timeline-step relative flex flex-1 gap-3 sm:flex-col sm:items-center sm:gap-2 sm:text-center",
              index < STEPS.length - 1 && "sm:pb-0",
            )}
          >
            <div className="flex flex-col items-center sm:contents">
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold",
                  reached
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-muted text-muted-foreground",
                  active && reached && "ring-primary/35 ring-2",
                )}
                aria-current={active ? "step" : undefined}
              >
                {reached && index < current ? (
                  <Check className="size-4" aria-hidden />
                ) : (
                  index + 1
                )}
              </span>
              {index < STEPS.length - 1 ? (
                <span
                  className="bg-border absolute top-4 left-10 hidden h-0.5 w-[calc(100%-2rem)] sm:block sm:static sm:mt-0 sm:h-0.5 sm:w-full sm:flex-1"
                  aria-hidden
                />
              ) : null}
            </div>
            <div className="min-w-0 pb-4 sm:pb-0">
              <p
                className={cn(
                  "text-[13px] font-semibold",
                  reached ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {step.label}
              </p>
              {ts ? (
                <p className="text-muted-foreground text-[11px] tabular-nums">
                  {formatShort(ts)}
                </p>
              ) : (
                <p className="text-muted-foreground text-[11px]">—</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
