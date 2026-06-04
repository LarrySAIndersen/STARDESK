"use client";

import { useState, useEffect, useCallback } from "react";
import { apiGet } from "@/lib/api";
import { StarSectionCard } from "@/components/star/section-card";
import { Button } from "@/components/ui/button";
import { ItilTicketTable } from "@/components/itil-ticket-table";
import type { CustomReportResponse, ReportTicketRow } from "@/types/report";
import type { Ticket } from "@/types/ticket";
import { fireAndForget } from "@/lib/fire-and-forget";

function reportRowToTicket(row: ReportTicketRow): Ticket {
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

export function CustomReports() {
  const [groupBy, setGroupBy] = useState<string>("status");
  const [ticketType, setTicketType] = useState<string>("");
  const [priority, setPriority] = useState<string>("");
  const [periodDays, setPeriodDays] = useState<number>(30);

  const [report, setReport] = useState<CustomReportResponse | null>(null);
  const [activeGroupKey, setActiveGroupKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("group_by", groupBy);
      params.set("period_days", String(periodDays));
      if (ticketType) params.set("ticket_type", ticketType);
      if (priority) params.set("priority", priority);

      const response = await apiGet<CustomReportResponse>(`/api/v1/reports/custom?${params.toString()}`);
      setReport(response);
      
      // Auto-select first group if available
      if (response.groups.length > 0) {
        setActiveGroupKey((prev) => {
          if (response.groups.some((g) => g.group_key === prev)) {
            return prev;
          }
          return response.groups[0].group_key;
        });
      } else {
        setActiveGroupKey(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke hente brugerdefineret rapport");
    } finally {
      setLoading(false);
    }
  }, [groupBy, ticketType, priority, periodDays]);

  useEffect(() => {
    fireAndForget(loadReport());
  }, [loadReport]);

  function handleExport() {
    const params = new URLSearchParams();
    params.set("group_by", groupBy);
    params.set("period_days", String(periodDays));
    if (ticketType) params.set("ticket_type", ticketType);
    if (priority) params.set("priority", priority);

    const url = `/api/proxy/v1/reports/custom/export?${params.toString()}`;
    fetch(url, { credentials: "same-origin" })
      .then((res) => {
        if (!res.ok) {
          throw new Error("Export failed");
        }
        return res.blob();
      })
      .then((blob) => {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `stardesk-rapport-${groupBy}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
      })
      .catch(() => setError("Kunne ikke hente CSV-eksport"));
  }

  const selectedGroup = report?.groups.find((g) => g.group_key === activeGroupKey) || null;

  return (
    <div className="space-y-8">
      {/* Configuration Panel */}
      <StarSectionCard
        variant="navy"
        title="Rapportbygger — Brugerdefinerede Rapporter"
        description="Byg din egen rapport ved at konfigurere grupperingsparametre og filtrere på tværs af sagstyper, prioritet og oprettelsesperiode. Download som CSV til videre bearbejdning."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
          <div>
            <label htmlFor="group-by" className="text-star-navy text-xs font-semibold block mb-1">
              Grupper efter
            </label>
            <select
              id="group-by"
              className="border-input flex h-9 w-full rounded-sm border bg-white px-3 py-1 text-sm text-star-navy font-medium"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
            >
              <option value="status">Status</option>
              <option value="priority">Prioritet</option>
              <option value="ticket_type">Sagstype</option>
              <option value="assigned_team">Ansvarlig gruppe (Team)</option>
            </select>
          </div>

          <div>
            <label htmlFor="ticket-type-filter" className="text-star-navy text-xs font-semibold block mb-1">
              Filtrer på sagstype
            </label>
            <select
              id="ticket-type-filter"
              className="border-input flex h-9 w-full rounded-sm border bg-white px-3 py-1 text-sm text-star-navy font-medium"
              value={ticketType}
              onChange={(e) => setTicketType(e.target.value)}
            >
              <option value="">Alle sagstyper</option>
              <option value="incident">Hændelser (Incidents)</option>
              <option value="service_request">Serviceanmodninger (Service Requests)</option>
              <option value="problem">Problemer</option>
            </select>
          </div>

          <div>
            <label htmlFor="priority-filter" className="text-star-navy text-xs font-semibold block mb-1">
              Filtrer på prioritet
            </label>
            <select
              id="priority-filter"
              className="border-input flex h-9 w-full rounded-sm border bg-white px-3 py-1 text-sm text-star-navy font-medium"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="">Alle prioriteter</option>
              <option value="critical">Kritisk</option>
              <option value="high">Høj</option>
              <option value="medium">Medium</option>
              <option value="low">Lav</option>
            </select>
          </div>

          <div>
            <label htmlFor="period-filter" className="text-star-navy text-xs font-semibold block mb-1">
              Oprettelsesperiode
            </label>
            <select
              id="period-filter"
              className="border-input flex h-9 w-full rounded-sm border bg-white px-3 py-1 text-sm text-star-navy font-medium"
              value={periodDays}
              onChange={(e) => setPeriodDays(Number(e.target.value))}
            >
              <option value={7}>Seneste 7 dage</option>
              <option value={30}>Seneste 30 dage</option>
              <option value={90}>Seneste 90 dage</option>
              <option value={365}>Seneste 365 dage</option>
              <option value={0}>Alle perioder</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-4 mt-6">
          <Button
            type="button"
            className="bg-star-blue hover:bg-star-navy rounded-sm"
            onClick={() => fireAndForget(loadReport())}
            disabled={loading}
          >
            {loading ? "Henter..." : "Generer rapport"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-star-blue text-star-blue rounded-sm"
            onClick={handleExport}
            disabled={loading || !report || report.total_tickets === 0}
          >
            Eksporter til CSV
          </Button>
        </div>
      </StarSectionCard>

      {error && (
        <div className="p-4 rounded-sm border border-star-red/20 bg-red-50 text-star-red text-sm" role="alert">
          {error}
        </div>
      )}

      {loading && !report && (
        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-star-blue border-t-transparent" />
          <p className="text-muted-foreground text-sm" aria-live="polite">Analyserer sagsdata og danner grupperingsrapport...</p>
        </div>
      )}

      {report && (
        <>
          {/* Summary Table */}
          <section aria-labelledby="custom-summary-heading" className="space-y-4">
            <h2 id="custom-summary-heading" className="text-star-navy text-lg font-semibold">
              Rapportoversigt (I alt {report.total_tickets} {report.total_tickets === 1 ? "sag" : "sager"})
            </h2>
            
            {report.groups.length === 0 ? (
              <p className="text-muted-foreground text-sm italic">Ingen sager matcher de valgte kriterier.</p>
            ) : (
              <div className="overflow-x-auto border border-slate-100 rounded-sm">
                <table className="w-full text-left border-collapse bg-white">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-star-navy text-xs font-bold uppercase tracking-wider">
                      <th className="p-4">Grupperingskategori</th>
                      <th className="p-4 text-center">Antal sager</th>
                      <th className="p-4 text-center">Procentdel</th>
                      <th className="p-4 text-center">Gns. løsningstid (MTTR)</th>
                      <th className="p-4 text-center">SLA-overholdelse</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {report.groups.map((group) => (
                      <tr
                        key={group.group_key}
                        className={`hover:bg-slate-50/50 cursor-pointer transition-colors ${
                          activeGroupKey === group.group_key ? "bg-slate-50 font-medium" : ""
                        }`}
                        onClick={() => setActiveGroupKey(group.group_key)}
                      >
                        <td className="p-4 text-star-navy">
                          <button
                            type="button"
                            className="text-left w-full hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-star-blue"
                          >
                            {group.group_label_da}
                          </button>
                        </td>
                        <td className="p-4 text-center tabular-nums">{group.count}</td>
                        <td className="p-4 text-center tabular-nums">{group.percentage}%</td>
                        <td className="p-4 text-center tabular-nums">
                          {group.avg_resolution_time_hours != null
                            ? `${group.avg_resolution_time_hours} t`
                            : "—"}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-center space-x-2">
                            <span className="tabular-nums text-xs">{group.sla_compliance_pct}%</span>
                            <div className="h-2 w-16 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                              <div
                                className={`h-full rounded-full ${
                                  group.sla_compliance_pct != null && group.sla_compliance_pct < 75
                                    ? "bg-star-red"
                                    : "bg-emerald-600"
                                }`}
                                style={{ width: `${group.sla_compliance_pct ?? 100}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Detailed Ticket List for Active Group */}
          {selectedGroup && (
            <StarSectionCard
              variant="accent"
              title={`${selectedGroup.group_label_da} (${selectedGroup.count})`}
              description={`Sager tilhørende gruppen '${selectedGroup.group_label_da}'. Klik på en række i oversigten ovenfor for at skifte kategori.`}
            >
              {selectedGroup.tickets.length === 0 ? (
                <p className="text-muted-foreground text-sm">Ingen sager tilgængelige.</p>
              ) : (
                <div className="overflow-x-auto">
                  <ItilTicketTable tickets={selectedGroup.tickets.map(reportRowToTicket)} />
                </div>
              )}
            </StarSectionCard>
          )}

          <p className="text-muted-foreground text-[10px]">
            Rapport genereret: {new Date(report.generated_at).toLocaleString("da-DK")}
          </p>
        </>
      )}
    </div>
  );
}
