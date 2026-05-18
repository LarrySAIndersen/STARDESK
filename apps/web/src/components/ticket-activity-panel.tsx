"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { TicketActivityItem, TicketTimestamps } from "@/types/ticket-activity";

function formatDate(iso: string | null | undefined): string {
  if (!iso) {
    return "—";
  }
  return new Intl.DateTimeFormat("da-DK", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

const MILESTONE_ROWS: { key: keyof TicketTimestamps; label: string }[] = [
  { key: "created_at", label: "Oprettet" },
  { key: "gdpr_consent_at", label: "GDPR-samtykke" },
  { key: "assigned_at", label: "Tildelt" },
  { key: "in_progress_at", label: "Igangsat" },
  { key: "on_hold_at", label: "På hold" },
  { key: "first_response_at", label: "Første svar" },
  { key: "resolved_at", label: "Løst" },
  { key: "closed_at", label: "Lukket" },
  { key: "cancelled_at", label: "Annulleret" },
  { key: "last_escalation_at", label: "Seneste eskalering" },
  { key: "updated_at", label: "Senest opdateret" },
];

function visibilityBadge(visibility: TicketActivityItem["visibility"]) {
  if (visibility === "internal") {
    return <Badge variant="secondary">Intern</Badge>;
  }
  if (visibility === "system") {
    return <Badge variant="outline">System</Badge>;
  }
  return null;
}

function CollapsibleCardSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <Card>
      <CardHeader className="gap-0 pb-0">
        <button
          type="button"
          id={`${panelId}-trigger`}
          className="hover:bg-muted/40 focus-visible:ring-ring -mx-4 flex w-[calc(100%+2rem)] items-start justify-between gap-3 rounded-t-xl px-4 py-1 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={panelId}
        >
          <span className="min-w-0 flex-1">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </span>
          <ChevronDown
            className={cn(
              "text-muted-foreground mt-0.5 size-4 shrink-0 transition-transform",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </button>
      </CardHeader>
      {open ? <CardContent id={panelId} aria-labelledby={`${panelId}-trigger`}>{children}</CardContent> : null}
    </Card>
  );
}

export function TicketActivityPanel({
  timestamps,
  activity,
}: {
  timestamps: TicketTimestamps;
  activity: TicketActivityItem[];
}) {
  return (
    <div className="space-y-6">
      <CollapsibleCardSection
        title="Tidsstempler"
        description="Milepæle fra oprettelse til opdatering og lukning (første gang hver status nås)."
      >
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          {MILESTONE_ROWS.map(({ key, label }) => {
            const value = timestamps[key];
            if (!value && key !== "created_at" && key !== "updated_at") {
              return null;
            }
            return (
              <div key={key} className="flex justify-between gap-4 border-b py-1.5 sm:block">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-mono text-xs sm:mt-0.5">{formatDate(value)}</dd>
              </div>
            );
          })}
          <div className="flex justify-between gap-4 border-b py-1.5 sm:block">
            <dt className="text-muted-foreground">SLA respons</dt>
            <dd className="font-mono text-xs">{formatDate(timestamps.response_due_at)}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b py-1.5 sm:block">
            <dt className="text-muted-foreground">SLA løsning</dt>
            <dd className="font-mono text-xs">{formatDate(timestamps.resolution_due_at)}</dd>
          </div>
        </dl>
      </CollapsibleCardSection>

      <CollapsibleCardSection
        title="Aktivitetslog"
        description="Kronologisk oversigt over alle registrerede handlinger på sagen."
      >
        {activity.length === 0 ? (
          <p className="text-muted-foreground text-sm">Ingen aktivitet registreret endnu.</p>
        ) : (
          <ol className="relative space-y-4 border-l pl-6">
            {activity.map((item) => (
              <li key={item.id} className="relative">
                <span className="bg-star-blue absolute top-1.5 -left-[1.4rem] size-2.5 rounded-full" />
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <time className="text-muted-foreground font-mono">
                    {formatDate(item.occurred_at)}
                  </time>
                  {visibilityBadge(item.visibility)}
                </div>
                <p className="mt-1 text-sm font-medium">{item.label_da}</p>
                {item.actor_display_name ? (
                  <p className="text-muted-foreground text-xs">{item.actor_display_name}</p>
                ) : null}
                {item.detail ? (
                  <p className="text-muted-foreground mt-0.5 text-xs">{item.detail}</p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </CollapsibleCardSection>
    </div>
  );
}
