import dynamic from "next/dynamic";
import Link from "next/link";

import { LongestTicketCard } from "@/components/dashboard/longest-ticket-card";
import { StarSectionCard } from "@/components/star/section-card";
import { Badge } from "@/components/ui/badge";
import { ResizableSplit } from "@/components/ui/resizable-split";
import {
  BUCKET_ACCENTS,
  BUCKET_DESCRIPTIONS_DA,
} from "@/lib/dashboard-buckets";
import { cn } from "@/lib/utils";
import type { OperationsDashboard } from "@/types/dashboard";

function ChartFallback() {
  return <div className="bg-muted/40 h-48 animate-pulse rounded-xl" aria-hidden />;
}

const Gauge = dynamic(
  () => import("@/components/dashboard/gauge").then((mod) => mod.Gauge),
  { loading: () => <ChartFallback /> },
);
const HorizontalBars = dynamic(
  () =>
    import("@/components/dashboard/horizontal-bars").then((mod) => mod.HorizontalBars),
  { loading: () => <ChartFallback /> },
);
const TrendChart = dynamic(
  () => import("@/components/dashboard/trend-chart").then((mod) => mod.TrendChart),
  { loading: () => <ChartFallback /> },
);

function OpsKpiCard({
  label,
  value,
  sub,
  accent = "border-t-star-blue",
  highlight,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "ledger-card border-t-4 p-4",
        accent,
        highlight && "ring-star-red/40 ring-2",
      )}
    >
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
        {label}
      </p>
      <p className="text-star-navy mt-1 text-3xl font-bold tabular-nums">{value}</p>
      {sub ? <p className="text-muted-foreground mt-1 text-xs leading-snug">{sub}</p> : null}
    </div>
  );
}

export function AgentOperationsDashboard({
  dashboard,
}: {
  dashboard: OperationsDashboard;
}) {
  const slaHealthPct =
    dashboard.open_count > 0
      ? Math.round(
          (100 * (dashboard.open_count - dashboard.sla_overdue_count)) / dashboard.open_count,
        )
      : 100;

  const backlogMax = Math.max(dashboard.open_count, 25, 1);
  const throughputPct = Math.min(
    100,
    Math.round(
      (dashboard.closed_last_7_days / Math.max(dashboard.opened_last_7_days, 1)) * 100,
    ),
  );

  const updatedLabel = new Intl.DateTimeFormat("da-DK", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(dashboard.generated_at));

  return (
    <div className="space-y-8">
      {/* Primary service desk KPIs */}
      <div>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h3 className="text-star-navy text-sm font-semibold uppercase tracking-wide">
            Nøgletal — drift
          </h3>
          <p className="text-muted-foreground text-xs">Opdateret {updatedLabel}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <OpsKpiCard label="Åbne sager" value={dashboard.open_count} accent="border-t-star-navy" />
          <OpsKpiCard
            label="SLA overskredet"
            value={dashboard.sla_overdue_count}
            sub={dashboard.sla_overdue_count > 0 ? "Kræver handling" : "Ingen overskridelser"}
            accent="border-t-star-red"
            highlight={dashboard.sla_overdue_count > 0}
          />
          <OpsKpiCard
            label="SLA inden 4 t"
            value={dashboard.sla_due_soon_count}
            sub="Forfald inden for 4 timer"
            accent="border-t-amber-500"
            highlight={dashboard.sla_due_soon_count > 0}
          />
          <OpsKpiCard
            label="Store sager"
            value={dashboard.major_open_count}
            sub="Åbne med markering Stor sag"
            accent="border-t-star-red"
            highlight={dashboard.major_open_count > 0}
          />
          <OpsKpiCard
            label="Løsningsgrad"
            value={`${dashboard.resolution_rate_pct}%`}
            sub="Lukket/løst seneste 30 d vs. åbne"
            accent="border-t-emerald-600"
          />
          <OpsKpiCard
            label="Gns. alder (åbne)"
            value={
              dashboard.avg_open_age_days != null ? `${dashboard.avg_open_age_days} d` : "—"
            }
            sub={`${dashboard.closed_count.toLocaleString("da-DK")} lukket i alt`}
            accent="border-t-star-blue"
          />
        </div>
      </div>

      {/* ITSM pipeline — same buckets as standard reports */}
      <div>
        <h3 className="text-star-navy mb-3 text-sm font-semibold uppercase tracking-wide">
          Sagspipeline
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {dashboard.bucket_counts.map((bucket) => (
            <div
              key={bucket.key}
              className={cn(
                "ledger-card border-t-4 p-4",
                BUCKET_ACCENTS[bucket.key] ?? "border-t-star-blue",
              )}
            >
              <p className="text-star-navy text-2xl font-bold tabular-nums">{bucket.count}</p>
              <p className="text-star-navy mt-1 text-sm font-semibold">{bucket.label_da}</p>
              <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                {BUCKET_DESCRIPTIONS_DA[bucket.key] ?? ""}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 7-day throughput + longest open ticket */}
      <ResizableSplit
        storageKey="stardesk-dashboard-throughput"
        defaultSizes={[48, 52]}
        minSizes={[32, 32]}
        className="min-h-[12rem]"
      >
        <LongestTicketCard ticket={dashboard.longest_open} />
        <StarSectionCard
          variant="accent"
          title="Aktivitet — seneste 7 dage"
          description="Modtaget vs. lukket sager i den valgte periode."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <OpsKpiCard
              label="Modtaget (7 d)"
              value={dashboard.opened_last_7_days}
              sub="Nye sager i perioden"
              accent="border-t-star-blue"
            />
            <OpsKpiCard
              label="Lukket (7 d)"
              value={dashboard.closed_last_7_days}
              sub={
                dashboard.opened_last_7_days > 0
                  ? `${throughputPct}% af modtagne lukket`
                  : "Ingen modtagne i perioden"
              }
              accent="border-t-emerald-600"
            />
          </div>
        </StarSectionCard>
      </ResizableSplit>

      {/* Gauges */}
      <StarSectionCard
        variant="navy"
        title="Driftsindikatorer"
        description="Backlog, SLA-overholdelse på åbne sager og gennemløb de seneste 7 dage."
      >
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {dashboard.major_open_count > 0 ? (
            <Badge className="border-0 bg-star-red text-white hover:bg-star-red/90">
              {dashboard.major_open_count} stor{dashboard.major_open_count === 1 ? "" : "e"} sag
              {dashboard.major_open_count === 1 ? "" : "er"}
            </Badge>
          ) : null}
          {dashboard.sla_due_soon_count > 0 ? (
            <Badge variant="secondary" className="border-star-blue/30 bg-white text-star-navy">
              {dashboard.sla_due_soon_count} SLA inden 4 t
            </Badge>
          ) : null}
          {dashboard.sla_overdue_count > 0 ? (
            <Badge variant="destructive">
              {dashboard.sla_overdue_count} SLA overskredet
            </Badge>
          ) : null}
        </div>
        <div className="grid gap-8 sm:grid-cols-3 sm:items-stretch">
          <Gauge
            label="Åben backlog"
            value={dashboard.open_count}
            max={backlogMax}
            hint={`Maks skala: ${backlogMax}`}
            accent="navy"
          />
          <Gauge
            label="SLA sundhed (åbne)"
            value={slaHealthPct}
            max={100}
            unit="%"
            hint={
              dashboard.sla_overdue_count > 0
                ? `${dashboard.sla_overdue_count} overskredet`
                : "Ingen overskridelser"
            }
            accent={slaHealthPct >= 80 ? "green" : slaHealthPct >= 50 ? "blue" : "red"}
          />
          <Gauge
            label="Gennemløb (7 d)"
            value={throughputPct}
            max={100}
            unit="%"
            hint={`${dashboard.closed_last_7_days} lukket / ${dashboard.opened_last_7_days} modtaget`}
            accent="blue"
          />
        </div>
      </StarSectionCard>

      {/* Charts */}
      <div className="grid gap-6 xl:grid-cols-2">
        <TrendChart
          title="Udvikling i sager"
          created={dashboard.daily_created}
          closed={dashboard.daily_closed}
        />
        <HorizontalBars
          id="status-breakdown"
          title="Fordeling på status"
          items={dashboard.status_breakdown}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <HorizontalBars
          id="priority-breakdown"
          title="Åbne sager efter prioritet"
          items={dashboard.priority_breakdown}
        />
        <section className="ledger-card flex flex-col justify-center border-primary/20 bg-secondary/50">
          <p className="text-foreground font-semibold">Klar til tildeling?</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Scroll til sagstildeling og grupper — eller åbn standardrapporter med detaljer per
            pipeline-trin.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="#dispatch-board"
              className="bg-primary hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm"
            >
              Gå til tildeling
            </Link>
            <Link
              href="/reports"
              className="border-primary text-primary hover:bg-card rounded-lg border bg-card/80 px-4 py-2 text-sm font-semibold"
            >
              Standardrapporter
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
