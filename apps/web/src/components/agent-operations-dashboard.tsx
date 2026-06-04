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
import {
  buildTicketsFilterHref,
  type DashboardScope,
} from "@/lib/dashboard-ticket-links";
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

function openedTodayCount(
  dailyCreated: OperationsDashboard["daily_created"],
  generatedAt: string,
): number {
  const dayKey = new Date(generatedAt).toISOString().slice(0, 10);
  return dailyCreated.find((d) => d.date === dayKey)?.count ?? 0;
}

function OpsKpiCard({
  label,
  value,
  sub,
  accent = "border-t-star-blue",
  highlight,
  href,
  compact,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
  highlight?: boolean;
  href?: string;
  compact?: boolean;
}) {
  const className = cn(
    "ledger-card block border-t-4 transition-shadow",
    compact ? "dashboard-ops-mini-card" : "p-4",
    accent,
    highlight && "ring-star-red/40 ring-2",
    href &&
      "cursor-pointer hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-star-blue",
  );
  const inner = (
    <>
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
        {label}
      </p>
      <p className="text-star-navy mt-1 text-3xl font-bold tabular-nums">{value}</p>
      {sub ? <p className="text-muted-foreground mt-1 text-xs leading-snug">{sub}</p> : null}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={className} aria-label={`${label}: ${value}`}>
        {inner}
      </Link>
    );
  }
  return <div className={className}>{inner}</div>;
}

export function AgentOperationsDashboard({
  dashboard,
  scope = "personal",
}: {
  dashboard: OperationsDashboard;
  scope?: DashboardScope;
}) {
  const filter = { scope };
  const ticketLink = (extra: Parameters<typeof buildTicketsFilterHref>[0]) =>
    buildTicketsFilterHref({ ...filter, ...extra });
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
  const openedToday = openedTodayCount(dashboard.daily_created, dashboard.generated_at);

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
          <OpsKpiCard
            label="Åbne sager"
            value={dashboard.open_count}
            accent="border-t-star-navy"
            href={ticketLink({ openOnly: true })}
          />
          <OpsKpiCard
            label="SLA overskredet"
            value={dashboard.sla_overdue_count}
            sub={dashboard.sla_overdue_count > 0 ? "Kræver handling" : "Ingen overskridelser"}
            accent="border-t-star-red"
            highlight={dashboard.sla_overdue_count > 0}
            href={ticketLink({ openOnly: true, sla: "overdue" })}
          />
          <OpsKpiCard
            label="SLA inden 4 t"
            value={dashboard.sla_due_soon_count}
            sub="Forfald inden for 4 timer"
            accent="border-t-amber-500"
            highlight={dashboard.sla_due_soon_count > 0}
            href={ticketLink({ openOnly: true, sla: "due_soon" })}
          />
          <OpsKpiCard
            label="Store sager"
            value={dashboard.major_open_count}
            sub="Åbne med markering Stor sag"
            accent="border-t-star-red"
            highlight={dashboard.major_open_count > 0}
            href={ticketLink({ majorOpen: true })}
          />
          <OpsKpiCard
            label="Løsningsgrad"
            value={`${dashboard.resolution_rate_pct}%`}
            sub="Lukket/løst seneste 30 d vs. åbne"
            accent="border-t-emerald-600"
            href={ticketLink({ closedSinceDays: 30 })}
          />
          <OpsKpiCard
            label="Gns. alder (åbne)"
            value={
              dashboard.avg_open_age_days != null ? `${dashboard.avg_open_age_days} d` : "—"
            }
            sub={`${dashboard.closed_count.toLocaleString("da-DK")} lukket i alt`}
            accent="border-t-star-blue"
            href={ticketLink({ openOnly: true })}
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
            <Link
              key={bucket.key}
              href={ticketLink({ bucket: bucket.key })}
              className={cn(
                "ledger-card block border-t-4 p-4 transition-shadow hover:shadow-md",
                BUCKET_ACCENTS[bucket.key] ?? "border-t-star-blue",
              )}
              aria-label={`${bucket.label_da}: ${bucket.count} sager`}
            >
              <p className="text-star-navy text-2xl font-bold tabular-nums">{bucket.count}</p>
              <p className="text-star-navy mt-1 text-sm font-semibold">{bucket.label_da}</p>
              <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                {BUCKET_DESCRIPTIONS_DA[bucket.key] ?? ""}
              </p>
            </Link>
          ))}
        </div>
      </div>

      {/* 7-day throughput + longest open ticket */}
      <ResizableSplit
        storageKey="stardesk-dashboard-throughput"
        defaultSizes={[48, 52]}
        minSizes={[32, 32]}
        className="dashboard-throughput-split min-h-[12rem]"
        panelClassName="min-h-0"
        stackBelowLg
      >
        <LongestTicketCard ticket={dashboard.longest_open} />
        <StarSectionCard
          variant="accent"
          title="Aktivitet — seneste 7 dage"
          description="Nye sager i dag og SLA-brud i det valgte omfang."
          bodyClassName="star-section-body--spacious"
        >
          <div className="grid gap-6 sm:grid-cols-2">
            <OpsKpiCard
              label="Nye i dag"
              value={openedToday}
              sub={`${dashboard.opened_last_7_days.toLocaleString("da-DK")} modtaget seneste 7 d`}
              accent="border-t-star-blue"
              compact
              href={ticketLink({ openedSinceDays: 7 })}
            />
            <OpsKpiCard
              label="SLA-brud"
              value={dashboard.sla_overdue_count}
              sub={
                dashboard.sla_due_soon_count > 0
                  ? `${dashboard.sla_due_soon_count} forfalder inden 4 t`
                  : "Ingen SLA inden 4 t"
              }
              accent="border-t-star-red"
              highlight={dashboard.sla_overdue_count > 0}
              compact
              href={ticketLink({ openOnly: true, sla: "overdue" })}
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
            <Badge className="border-0 bg-star-red text-white [a]:hover:bg-star-red/90">
              <Link href={ticketLink({ majorOpen: true })}>
                {dashboard.major_open_count} stor{dashboard.major_open_count === 1 ? "" : "e"}{" "}
                sag{dashboard.major_open_count === 1 ? "" : "er"}
              </Link>
            </Badge>
          ) : null}
          {dashboard.sla_due_soon_count > 0 ? (
            <Badge
              variant="secondary"
              className="border-star-blue/30 bg-white text-star-navy [a]:hover:bg-white/90"
            >
              <Link href={ticketLink({ openOnly: true, sla: "due_soon" })}>
                {dashboard.sla_due_soon_count} SLA inden 4 t
              </Link>
            </Badge>
          ) : null}
          {dashboard.sla_overdue_count > 0 ? (
            <Badge variant="destructive">
              <Link href={ticketLink({ openOnly: true, sla: "overdue" })}>
                {dashboard.sla_overdue_count} SLA overskredet
              </Link>
            </Badge>
          ) : null}
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:items-stretch lg:gap-8">
          <Gauge
            label="Åben backlog"
            value={dashboard.open_count}
            max={backlogMax}
            hint={`Maks skala: ${backlogMax}`}
            accent="navy"
            href={ticketLink({ openOnly: true })}
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
            href={
              dashboard.sla_overdue_count > 0
                ? ticketLink({ openOnly: true, sla: "overdue" })
                : ticketLink({ openOnly: true })
            }
          />
          <div className="flex flex-col items-center gap-1">
            <Gauge
              label="Gennemløb (7 d)"
              value={throughputPct}
              max={100}
              unit="%"
              hint="Seneste 7 dage — klik tal nedenfor"
              accent="blue"
              href={ticketLink({ closedSinceDays: 7 })}
            />
            <p className="text-muted-foreground flex flex-wrap justify-center gap-2 text-xs">
              <Link href={ticketLink({ closedSinceDays: 7 })} className="text-star-navy font-semibold hover:underline">
                {dashboard.closed_last_7_days} lukket
              </Link>
              <span aria-hidden>·</span>
              <Link href={ticketLink({ openedSinceDays: 7 })} className="text-star-navy font-semibold hover:underline">
                {dashboard.opened_last_7_days} modtaget
              </Link>
            </p>
          </div>
        </div>
      </StarSectionCard>

      {/* Charts */}
      <div className="grid gap-6 xl:grid-cols-2">
        <TrendChart
          title="Udvikling i sager"
          created={dashboard.daily_created}
          closed={dashboard.daily_closed}
          getCreatedHref={(day) =>
            day.count > 0 ? ticketLink({ createdOn: day.date }) : undefined
          }
          getClosedHref={(day) =>
            day.count > 0 ? ticketLink({ closedOn: day.date }) : undefined
          }
        />
        <HorizontalBars
          id="status-breakdown"
          title="Fordeling på status"
          items={dashboard.status_breakdown}
          getItemHref={(item) =>
            item.count > 0 ? ticketLink({ status: item.key }) : undefined
          }
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <HorizontalBars
          id="priority-breakdown"
          title="Åbne sager efter prioritet"
          items={dashboard.priority_breakdown}
          getItemHref={(item) =>
            item.count > 0
              ? ticketLink({ openOnly: true, priority: item.key })
              : undefined
          }
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
