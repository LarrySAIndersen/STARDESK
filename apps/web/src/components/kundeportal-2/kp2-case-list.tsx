"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { getClientUser } from "@/lib/auth";
import { fetchKp2Cases, isKp2CaseActive } from "@/lib/kundeportal-2/cases-api";
import type { Kp2CaseRow } from "@/lib/kundeportal-2/types";
import { KP2_BASE } from "@/lib/kundeportal-2/types";
import { priorityLabel, statusLabel } from "@/lib/ticket-labels";

const TYPE_LABELS: Record<Kp2CaseRow["type"], string> = {
  incident: "Incident",
  service_request: "Service request",
  change: "Change",
};

type Kp2CaseListProps = {
  extended?: boolean;
};

export function Kp2CaseList({ extended = false }: Kp2CaseListProps) {
  const user = getClientUser();
  const [cases, setCases] = useState<Kp2CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("aktiv");
  const [typeFilter, setTypeFilter] = useState("alle");
  const [mineOnly, setMineOnly] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadCases() {
      setLoading(true);
      setFetchError(null);
      try {
        const rows = await fetchKp2Cases();
        if (!cancelled) {
          setCases(rows);
        }
      } catch (err) {
        if (!cancelled) {
          setFetchError(
            err instanceof Error ? err.message : "Kunne ikke hente sager fra API",
          );
          setCases([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadCases();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    return cases.filter((row) => {
      if (statusFilter === "aktiv" && !isKp2CaseActive(row)) return false;
      if (typeFilter !== "alle" && row.type !== typeFilter) return false;
      if (mineOnly && user?.id && row.reporterUserId !== user.id) return false;
      return true;
    });
  }, [cases, statusFilter, typeFilter, mineOnly, user?.id]);

  return (
    <div className="portal-v2-page mx-auto w-full max-w-5xl space-y-6 pb-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="kp2-page-title">
            {extended ? "Mine sager (udvidet)" : "Mine forespoergsler"}
          </h1>
          <p className="text-muted-foreground text-sm">
            Oversigt over dine sager og henvendelser.
          </p>
        </div>
        <Link href={`${KP2_BASE}/service-requests/sporgsmaal`} className="kp2-btn-primary">
          Opret ny henvendelse
        </Link>
      </header>

      <div className="kp2-toolbar">
        <label className="flex items-center gap-2 text-sm">
          Status
          <select
            className="kp2-input kp2-input--inline"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="aktiv">Aktiv</option>
            <option value="alle">Alle</option>
          </select>
        </label>
        {extended ? (
          <label className="flex items-center gap-2 text-sm">
            Type
            <select
              className="kp2-input kp2-input--inline"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="alle">Alle typer forespoergsler</option>
              <option value="incident">Incident</option>
              <option value="service_request">Service request</option>
              <option value="change">Change</option>
            </select>
          </label>
        ) : null}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={mineOnly}
            onChange={(e) => setMineOnly(e.target.checked)}
          />
          Vis kun mine henvendelser
        </label>
      </div>

      {loading ? (
        <div className="kp2-empty">
          <p className="text-muted-foreground text-sm">Henter dine sager...</p>
        </div>
      ) : fetchError ? (
        <div className="kp2-empty">
          <p className="font-medium">Kunne ikke hente sager</p>
          <p className="text-muted-foreground mt-2 text-sm">{fetchError}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="kp2-empty">
          <p className="font-medium">Ingen sager endnu</p>
          <p className="text-muted-foreground mt-2 text-sm">
            Her ser du dine incidents, service requests og changes. Opret din foerste henvendelse
            via kataloget.
          </p>
          <Link href={`${KP2_BASE}/service-requests`} className="kp2-btn-primary mt-4 inline-flex">
            Gaa til Service Requests
          </Link>
        </div>
      ) : (
        <div className="kp2-card overflow-hidden">
          <table className="kp2-table">
            <thead>
              <tr>
                <th>Sagsnr.</th>
                <th>Titel</th>
                {extended ? <th>Type</th> : null}
                <th>Status</th>
                <th>Prioritet</th>
                {extended ? <th>Rekvirent</th> : null}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td className="font-mono text-xs">{row.number}</td>
                  <td>
                    <Link
                      href={`/portal-v2/sag/${row.id}`}
                      className="text-primary hover:underline"
                    >
                      {row.title}
                    </Link>
                  </td>
                  {extended ? <td>{TYPE_LABELS[row.type]}</td> : null}
                  <td>{statusLabel(row.status)}</td>
                  <td>{priorityLabel(row.priority)}</td>
                  {extended ? <td>{row.requester}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
