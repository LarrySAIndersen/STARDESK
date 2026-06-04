"use client";

import { fireAndForget } from "@/lib/fire-and-forget";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ItilTicketTable } from "@/components/itil-ticket-table";
import { buildTicketsFilterHref } from "@/lib/dashboard-ticket-links";
import { StarSectionCard } from "@/components/star/section-card";
import { TicketExcelExportButton } from "@/components/ticket-excel-export-button";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/api";
import type { OperationsDashboard } from "@/types/dashboard";
import type { StandardReport } from "@/types/report";
import type { Ticket } from "@/types/ticket";

const STATUS_BUCKET_KEYS = ["modtaget", "igangsat", "lost", "lukket"] as const;
const GENAABNET_KEY = "genaabnet";

const BUCKET_ACCENTS: Record<string, string> = {
  modtaget: "border-t-star-blue",
  igangsat: "border-t-star-navy",
  lost: "border-t-emerald-600",
  lukket: "border-t-gray-500",
  genaabnet: "border-t-star-red",
};

function ReportKpiCard({
  label,
  value,
  sub,
  href,
}: {
  label: string;
  value: string | number;
  sub?: string;
  href?: string;
}) {
  const inner = (
    <>
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
        {label}
      </p>
      <p className="text-star-navy mt-1 text-2xl font-bold tabular-nums sm:text-3xl">{value}</p>
      {sub ? <p className="text-muted-foreground mt-1 text-xs">{sub}</p> : null}
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="ledger-card border-t-primary block border-t-4 p-4 transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-star-blue"
        aria-label={`${label}: ${value}`}
      >
        {inner}
      </Link>
    );
  }
  return <div className="ledger-card border-t-primary border-t-4 p-4">{inner}</div>;
}

function reportRowToTicket(row: StandardReport["buckets"][0]["tickets"][0]): Ticket {
  return {
    id: row.id,
    ticket_number: row.ticket_number,
    title: row.title,
    status: row.status,
    priority: row.priority,
    ticket_type: row.ticket_type,
    is_major: false,
    sub_causes: [],
    assigned_team_name: row.assigned_team_name,
    assigned_user_name: row.assigned_user_name,
    reporter_display_name: null,
    response_due_at: null,
    resolution_due_at: null,
    created_at: row.created_at,
  };
}

function BucketCard({
  bucket,
  active,
  onSelect,
  ticketsHref,
}: {
  bucket: StandardReport["buckets"][0];
  active: boolean;
  onSelect: () => void;
  ticketsHref?: string;
}) {
  return (
    <div
      className={`ledger-card border-t-4 p-4 text-left transition-shadow hover:shadow-md ${
        BUCKET_ACCENTS[bucket.key] ?? "border-t-star-blue"
      } ${active ? "ring-star-blue ring-2" : ""}`}
    >
      {ticketsHref && bucket.count > 0 ? (
        <Link
          href={ticketsHref}
          className="text-star-navy block text-2xl font-bold tabular-nums hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-star-blue"
          aria-label={`${bucket.label_da}: ${bucket.count} sager — åbn sagliste`}
        >
          {bucket.count}
        </Link>
      ) : (
        <p className="text-star-navy text-2xl font-bold tabular-nums">{bucket.count}</p>
      )}
      <button
        type="button"
        onClick={onSelect}
        className="mt-1 w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-star-blue"
      >
        <span className="text-star-navy text-sm font-semibold">{bucket.label_da}</span>
        <span className="text-muted-foreground mt-1 block line-clamp-2 text-xs">
          {bucket.description_da}
        </span>
      </button>
    </div>
  );
}

export function ReportsDashboard() {
  const [report, setReport] = useState<StandardReport | null>(null);
  const [dashboard, setDashboard] = useState<OperationsDashboard | null>(null);
  const [periodDays, setPeriodDays] = useState(30);
  const [activeBucket, setActiveBucket] = useState<string>("modtaget");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reportData, dashboardData] = await Promise.all([
        apiGet<StandardReport>(`/api/v1/reports/standard?period_days=${periodDays}`),
        apiGet<OperationsDashboard>("/api/v1/reports/dashboard"),
      ]);
      setReport(reportData);
      setDashboard(dashboardData);
      setActiveBucket((current) => {
        if (reportData.buckets.some((b) => b.key === current)) {
          return current;
        }
        return reportData.buckets[0]?.key ?? "modtaget";
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke hente rapport");
    } finally {
      setLoading(false);
    }
  }, [periodDays]);

  useEffect(() => {
    fireAndForget(loadReport());
  }, [loadReport]);

  const statusBuckets = useMemo(
    () =>
      report?.buckets.filter((b) =>
        STATUS_BUCKET_KEYS.includes(b.key as (typeof STATUS_BUCKET_KEYS)[number]),
      ) ?? [],
    [report],
  );

  const genaabnetBucket = useMemo(
    () => report?.buckets.find((b) => b.key === GENAABNET_KEY) ?? null,
    [report],
  );

  const openFromReport = useMemo(() => {
    return statusBuckets
      .filter((b) => b.key === "modtaget" || b.key === "igangsat")
      .reduce((sum, b) => sum + b.count, 0);
  }, [statusBuckets]);

  const selected = report?.buckets.find((b) => b.key === activeBucket);

  function downloadCsv(bucket?: string) {
    const params = new URLSearchParams({ period_days: String(periodDays) });
    if (bucket) {
      params.set("bucket", bucket);
    }
    const url = `/api/proxy/v1/reports/standard/export?${params.toString()}`;
    fetch(url, { credentials: "same-origin" })
      .then((res) => {
        if (!res.ok) {
          throw new Error("export failed");
        }
        return res.blob();
      })
      .then((blob) => {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "rapport.csv";
        link.click();
        URL.revokeObjectURL(link.href);
      })
      .catch(() => setError("Kunne ikke hente CSV"));
  }

  const periodLabel =
    periodDays === 0
      ? "alle perioder"
      : periodDays === 1
        ? "seneste dag"
        : `seneste ${periodDays} dage`;

  const reportTicketLink = (bucketKey: string) =>
    buildTicketsFilterHref({ scope: "all", bucket: bucketKey });

  return (
    <div className="space-y-8">
      <StarSectionCard
        variant="navy"
        title="Standardrapporter — Service Desk Manager"
        description="ITSM-overblik: åbne og lukkede sager, sagspipeline (modtaget → igangsat → løst → lukket) og genåbninger. Eksporter til CSV eller Excel."
      >
        <div className="flex flex-wrap items-end gap-4">
          <Button
            type="button"
            className="bg-star-blue hover:bg-star-navy rounded-sm"
            onClick={() => fireAndForget(loadReport())}
            disabled={loading}
          >
            {loading ? "Henter…" : "Opdater rapport"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-star-blue text-star-blue rounded-sm"
            onClick={() => downloadCsv()}
          >
            Download alle (CSV)
          </Button>
          <TicketExcelExportButton />
        </div>
      </StarSectionCard>

      {error ? <p className="text-star-red text-sm">{error}</p> : null}

      {dashboard ? (
        <section aria-labelledby="reports-kpi-heading">
          <h2 id="reports-kpi-heading" className="text-star-navy mb-4 text-lg font-semibold">
            Nøgletal (drift)
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            <ReportKpiCard
              label="Åbne sager"
              value={dashboard.open_count}
              href={buildTicketsFilterHref({ scope: "all", openOnly: true })}
            />
            <ReportKpiCard
              label="I pipeline"
              value={openFromReport}
              sub="Modtaget + igangsat"
              href={buildTicketsFilterHref({ scope: "all", bucket: "modtaget" })}
            />
            <ReportKpiCard
              label="Lukket (7 dage)"
              value={dashboard.closed_last_7_days}
              href={buildTicketsFilterHref({ scope: "all", closedSinceDays: 7 })}
            />
            <ReportKpiCard
              label="Gns. alder (åbne)"
              value={
                dashboard.avg_open_age_days != null ? `${dashboard.avg_open_age_days} d` : "—"
              }
              href={buildTicketsFilterHref({ scope: "all", openOnly: true })}
            />
            <ReportKpiCard
              label="Løsningsgrad (30 d)"
              value={`${dashboard.resolution_rate_pct}%`}
              href={buildTicketsFilterHref({ scope: "all", closedSinceDays: 30 })}
            />
            <ReportKpiCard
              label="SLA overskredet"
              value={dashboard.sla_overdue_count}
              sub={
                dashboard.sla_due_soon_count > 0
                  ? `${dashboard.sla_due_soon_count} forfalder snart`
                  : undefined
              }
              href={buildTicketsFilterHref({
                scope: "all",
                openOnly: true,
                sla: "overdue",
              })}
            />
          </div>
        </section>
      ) : null}

      {report ? (
        <>
          <section aria-labelledby="reports-pipeline-heading">
            <h2 id="reports-pipeline-heading" className="text-star-navy mb-2 text-lg font-semibold">
              Sagspipeline (nuværende status)
            </h2>
            <p className="text-muted-foreground mb-4 text-sm">
              Fordeling af alle sager efter aktuel status. Klik en kategori for at se sagslisten.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {statusBuckets.map((bucket) => (
                <BucketCard
                  key={bucket.key}
                  bucket={bucket}
                  active={activeBucket === bucket.key}
                  onSelect={() => setActiveBucket(bucket.key)}
                  ticketsHref={reportTicketLink(bucket.key)}
                />
              ))}
            </div>
          </section>

          <section aria-labelledby="reports-reopen-heading" className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 id="reports-reopen-heading" className="text-star-navy text-lg font-semibold">
                  Genåbnet
                </h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  Sager genåbnet efter løsning eller lukning — filtreret på periode.
                </p>
              </div>
              <div>
                <label htmlFor="period-days" className="text-star-navy text-sm font-medium">
                  Periode for genåbninger
                </label>
                <select
                  id="period-days"
                  className="border-input mt-1 flex h-9 w-full min-w-[12rem] rounded-sm border bg-white px-3 text-sm sm:w-auto"
                  value={periodDays}
                  onChange={(e) => setPeriodDays(Number(e.target.value))}
                >
                  <option value={7}>7 dage</option>
                  <option value={30}>30 dage</option>
                  <option value={90}>90 dage</option>
                  <option value={365}>365 dage</option>
                  <option value={0}>Alle genåbninger</option>
                </select>
              </div>
            </div>

            {genaabnetBucket ? (
              <div className="grid gap-4 lg:grid-cols-[minmax(0,16rem)_1fr]">
                <BucketCard
                  bucket={genaabnetBucket}
                  active={activeBucket === GENAABNET_KEY}
                  onSelect={() => setActiveBucket(GENAABNET_KEY)}
                  ticketsHref={reportTicketLink(GENAABNET_KEY)}
                />
                <p className="text-muted-foreground self-center text-sm lg:col-start-2">
                  <Link
                    href={reportTicketLink(GENAABNET_KEY)}
                    className="text-star-navy font-semibold hover:underline"
                  >
                    {genaabnetBucket.count} genåbning{genaabnetBucket.count === 1 ? "" : "er"}
                  </Link>{" "}
                  i {periodLabel}.
                </p>
              </div>
            ) : null}
          </section>

          {selected ? (
            <StarSectionCard
              variant="accent"
              title={`${selected.label_da} (${selected.count})`}
              description={selected.description_da}
            >
              <div className="mb-4 flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  className="bg-star-blue hover:bg-star-navy rounded-sm"
                  onClick={() => downloadCsv(selected.key)}
                >
                  Download {selected.label_da} (CSV)
                </Button>
              </div>
              {selected.tickets.length === 0 ? (
                <p className="text-muted-foreground text-sm">Ingen sager i denne kategori.</p>
              ) : (
                <div className="overflow-x-auto">
                  <ItilTicketTable tickets={selected.tickets.map(reportRowToTicket)} />
                </div>
              )}
            </StarSectionCard>
          ) : null}

          <p className="text-muted-foreground text-xs">
            Genereret {new Date(report.generated_at).toLocaleString("da-DK")} ·{" "}
            <Link
              href={buildTicketsFilterHref({ scope: "all" })}
              className="text-star-navy font-medium hover:underline"
            >
              {report.total_tickets} sager i alt
            </Link>
          </p>
        </>
      ) : null}
    </div>
  );
}
