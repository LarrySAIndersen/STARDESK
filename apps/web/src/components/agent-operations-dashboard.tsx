import dynamic from "next/dynamic";
import Link from "next/link";

import { LongestTicketCard } from "@/components/dashboard/longest-ticket-card";
import { Badge } from "@/components/ui/badge";
import type { OperationsDashboard } from "@/types/dashboard";

function ChartFallback() {
  return <div className="bg-muted/40 h-48 animate-pulse rounded-sm" aria-hidden />;
}

const Gauge = dynamic(
  () => import("@/components/dashboard/gauge").then((mod) => mod.Gauge),
  { loading: () => <ChartFallback /> },
);
const HorizontalBars = dynamic(
  () => import("@/components/dashboard/horizontal-bars").then((mod) => mod.HorizontalBars),
  { loading: () => <ChartFallback /> },
);
const TrendChart = dynamic(
  () => import("@/components/dashboard/trend-chart").then((mod) => mod.TrendChart),
  { loading: () => <ChartFallback /> },
);

function kpiCard(label: string, value: string | number, sub?: string) {
  return (
    <div className="star-section-card border-t-star-blue border-t-4 p-4">
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
        {label}
      </p>
      <p className="text-star-navy mt-1 text-3xl font-bold tabular-nums">{value}</p>
      {sub ? <p className="text-muted-foreground mt-1 text-xs">{sub}</p> : null}
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

  return (
    <div className="space-y-8">
      <header className="star-hero">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="star-hero-title">Driftsdashboard</h1>
            <p className="star-hero-lead">
              Live overblik over sagsudvikling, SLA og den sag der har været åben længst.
            </p>
          </div>
          <p className="text-muted-foreground text-xs">
            Opdateret{" "}
            {new Intl.DateTimeFormat("da-DK", {
              dateStyle: "short",
              timeStyle: "short",
            }).format(new Date(dashboard.generated_at))}
          </p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <LongestTicketCard ticket={dashboard.longest_open} />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpiCard("Åbne sager", dashboard.open_count)}
          {kpiCard("Lukket (7 dage)", dashboard.closed_last_7_days)}
          {kpiCard(
            "Gns. alder (åbne)",
            dashboard.avg_open_age_days != null ? `${dashboard.avg_open_age_days} d` : "—",
          )}
          {kpiCard("Løsningsgrad (30 d)", `${dashboard.resolution_rate_pct}%`)}
        </div>
      </div>

      <div className="star-section-card overflow-hidden shadow-md">
        <div className="star-section-header--navy flex flex-wrap items-center justify-between gap-4 border-b-0 px-6 py-4">
          <div>
            <h2 className="star-section-title !text-white">Spidometre</h2>
            <p className="star-section-desc mt-1 !text-white/90">
              Backlog, SLA-overholdelse og gennemløb de seneste 7 dage
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {dashboard.major_open_count > 0 ? (
              <Badge className="border-0 bg-star-red text-white hover:bg-star-red/90">
                {dashboard.major_open_count} stor{dashboard.major_open_count === 1 ? "" : "e"} sag
                {dashboard.major_open_count === 1 ? "" : "er"}
              </Badge>
            ) : null}
            {dashboard.sla_due_soon_count > 0 ? (
              <Badge variant="secondary" className="border border-white/30 bg-white/15 text-white">
                {dashboard.sla_due_soon_count} SLA inden 4 t
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="star-section-body grid gap-8 sm:grid-cols-3 sm:items-stretch">
          <Gauge
            label="Åben backlog"
            value={dashboard.open_count}
            max={backlogMax}
            hint={`Maks skala: ${backlogMax}`}
            accent="navy"
          />
          <Gauge
            label="SLA sundhed"
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
            hint={`${dashboard.closed_last_7_days} lukket / ${dashboard.opened_last_7_days} oprettet`}
            accent="blue"
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
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

      <div className="grid gap-6 lg:grid-cols-2">
        <HorizontalBars
          id="priority-breakdown"
          title="Åbne sager efter prioritet"
          items={dashboard.priority_breakdown}
        />
        <HorizontalBars
          id="bucket-breakdown"
          title="Pipeline (modtaget → lukket)"
          items={dashboard.bucket_counts}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-sm border border-star-blue/30 bg-star-blue-light px-6 py-4">
        <div>
          <p className="text-star-navy font-semibold">Klar til tildeling?</p>
          <p className="text-muted-foreground text-sm">
            Scroll ned til sagsoversigt og grupper — eller gå til rapporter.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="#dispatch-board"
            className="bg-star-blue hover:bg-star-navy rounded-sm px-4 py-2 text-sm font-semibold text-white"
          >
            Gå til tildeling
          </Link>
          <Link
            href="/reports"
            className="border-star-blue text-star-blue hover:bg-white rounded-sm border px-4 py-2 text-sm font-semibold"
          >
            Standardrapporter
          </Link>
        </div>
      </div>
    </div>
  );
}
