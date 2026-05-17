"use client";

import { useCallback, useEffect, useState } from "react";

import { ItilTicketTable } from "@/components/itil-ticket-table";
import { StarSectionCard } from "@/components/star/section-card";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/api";
import { getClientToken } from "@/lib/auth";
import type { StandardReport } from "@/types/report";
import type { Ticket } from "@/types/ticket";

const BUCKET_ACCENTS: Record<string, string> = {
  modtaget: "border-t-star-blue",
  igangsat: "border-t-star-navy",
  lost: "border-t-emerald-600",
  lukket: "border-t-gray-500",
  genaabnet: "border-t-star-red",
};

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

export function ReportsDashboard() {
  const [report, setReport] = useState<StandardReport | null>(null);
  const [periodDays, setPeriodDays] = useState(30);
  const [activeBucket, setActiveBucket] = useState<string>("modtaget");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<StandardReport>(
        `/api/v1/reports/standard?period_days=${periodDays}`,
      );
      setReport(data);
      if (!data.buckets.some((b) => b.key === activeBucket)) {
        setActiveBucket(data.buckets[0]?.key ?? "modtaget");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke hente rapport");
    } finally {
      setLoading(false);
    }
  }, [periodDays, activeBucket]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  function downloadCsv(bucket?: string) {
    const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";
    const token = getClientToken();
    const params = new URLSearchParams({ period_days: String(periodDays) });
    if (bucket) {
      params.set("bucket", bucket);
    }
    const url = `${base}/api/v1/reports/standard/export?${params.toString()}`;
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "");
    if (token) {
      fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => res.blob())
        .then((blob) => {
          link.href = URL.createObjectURL(blob);
          link.click();
          URL.revokeObjectURL(link.href);
        })
        .catch(() => setError("Kunne ikke hente CSV"));
    }
  }

  const selected = report?.buckets.find((b) => b.key === activeBucket);

  return (
    <div className="space-y-8">
      <StarSectionCard
        variant="navy"
        title="Standardrapporter — Service Desk Manager"
        description="Oversigt over sager fordelt på modtaget, igangsat, løst, lukket og genåbnet. Eksporter til CSV til videre analyse."
      >
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="period-days" className="text-star-navy text-sm font-medium">
              Genåbnet — seneste dage
            </label>
            <select
              id="period-days"
              className="border-input mt-1 flex h-9 rounded-sm border bg-white px-3 text-sm"
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
          <Button
            type="button"
            className="bg-star-blue hover:bg-star-navy rounded-sm"
            onClick={() => void loadReport()}
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
        </div>
      </StarSectionCard>

      {error ? <p className="text-star-red text-sm">{error}</p> : null}

      {report ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {report.buckets.map((bucket) => (
              <button
                key={bucket.key}
                type="button"
                onClick={() => setActiveBucket(bucket.key)}
                className={`star-section-card border-t-4 p-4 text-left transition-shadow hover:shadow-md ${
                  BUCKET_ACCENTS[bucket.key] ?? "border-t-star-blue"
                } ${activeBucket === bucket.key ? "ring-star-blue ring-2" : ""}`}
              >
                <p className="text-star-navy text-2xl font-bold">{bucket.count}</p>
                <p className="text-star-navy mt-1 text-sm font-semibold">{bucket.label_da}</p>
                <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                  {bucket.description_da}
                </p>
              </button>
            ))}
          </div>

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
                <ItilTicketTable
                  tickets={selected.tickets.map(reportRowToTicket)}
                  compact={selected.key === "genaabnet"}
                />
              )}
            </StarSectionCard>
          ) : null}

          <p className="text-muted-foreground text-xs">
            Genereret {new Date(report.generated_at).toLocaleString("da-DK")} ·{" "}
            {report.total_tickets} sager i alt
          </p>
        </>
      ) : null}
    </div>
  );
}
