"use client";

import { fireAndForget } from "@/lib/fire-and-forget";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";

import {
  formatAuditTime,
  nvdUrl,
  severityBadgeClass,
  severityBadgeLabel,
} from "@/lib/dependency-audit-ui";
import type { DependencyAuditReport, DependencyVulnerability } from "@/types/dependency-audit";

type SortKey = "cvss_score" | "package" | "severity";

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "critical" | "high" | "medium" | "low" | "neutral";
}) {
  const toneClass =
    tone === "critical"
      ? "border-red-200 bg-red-50 text-red-900"
      : tone === "high"
        ? "border-orange-200 bg-orange-50 text-orange-900"
        : tone === "medium"
          ? "border-amber-200 bg-amber-50 text-amber-900"
          : tone === "low"
            ? "border-sky-200 bg-sky-50 text-sky-900"
            : "border-[var(--gray-border)] bg-white text-[var(--gray-text)]";

  return (
    <div className={`wire-card flex flex-col gap-1 border ${toneClass}`}>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      <span className="text-xs font-medium uppercase tracking-wide opacity-80">{label}</span>
    </div>
  );
}

function sortVulnerabilities(
  rows: DependencyVulnerability[],
  key: SortKey,
  asc: boolean,
): DependencyVulnerability[] {
  const sorted = [...rows];
  sorted.sort((a, b) => {
    if (key === "cvss_score") {
      return (a.cvss_score ?? 0) - (b.cvss_score ?? 0);
    }
    if (key === "package") {
      return a.package.localeCompare(b.package, "da");
    }
    return a.severity.localeCompare(b.severity, "da");
  });
  return asc ? sorted : sorted.reverse();
}

async function fetchAudit(refresh: boolean): Promise<DependencyAuditReport> {
  const response = await fetch("/api/v1/admin/dependency-audit", {
    method: refresh ? "POST" : "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { detail?: string };
    throw new Error(body.detail ?? "Kunne ikke hente afhængighedsrapport");
  }
  return response.json() as Promise<DependencyAuditReport>;
}

export function AdminDependenciesPanel() {
  const [report, setReport] = useState<DependencyAuditReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("cvss_score");
  const [sortAsc, setSortAsc] = useState(false);

  const load = useCallback(async (refresh = false) => {
    setError(null);
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await fetchAudit(refresh);
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ukendt fejl");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fireAndForget(load(false));
  }, [load]);

  const sortedVulns = useMemo(() => {
    if (!report) return [];
    return sortVulnerabilities(report.vulnerabilities, sortKey, sortAsc);
  }, [report, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc((v) => !v);
    } else {
      setSortKey(key);
      setSortAsc(key === "package");
    }
  }

  if (loading && !report) {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-sm" aria-live="polite">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Henter afhængighedsrapport…
      </p>
    );
  }

  const summary = report?.summary;
  const showMockBanner =
    report?.source === "mock" || Boolean(report?.mock_banner);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {report ? (
            <p className="text-muted-foreground text-sm">
              Sidst opdateret: {formatAuditTime(report.generated_at)}
              {report.source === "cache" ? " (cache)" : null}
              {report.source === "mock" ? " (eksempeldata)" : null}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          className="wire-btn wire-btn-sm"
          disabled={refreshing}
          onClick={() => fireAndForget(load(true))}
        >
          {refreshing ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="size-4" aria-hidden />
          )}
          Kør kontrol nu
        </button>
      </div>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      {showMockBanner ? (
        <div
          className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
          role="status"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">Ingen live audit tilgængelig</p>
            <p className="mt-0.5 opacity-90">
              {report?.mock_banner ?? "Kør lokalt: npm run security:audit (fra scripts/)"}
            </p>
          </div>
        </div>
      ) : null}

      {report?.warnings?.length ? (
        <ul className="text-muted-foreground list-inside list-disc text-sm">
          {report.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}

      <section aria-labelledby="dep-summary-heading">
        <h2 id="dep-summary-heading" className="wire-card-title mb-3">
          Oversigt
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <SummaryCard label="Kritisk (CVSS ≥9)" value={summary?.critical ?? 0} tone="critical" />
          <SummaryCard label="Høj (7–8.9)" value={summary?.high ?? 0} tone="high" />
          <SummaryCard label="Medium (4–6.9)" value={summary?.medium ?? 0} tone="medium" />
          <SummaryCard label="Lav (&lt;4)" value={summary?.low ?? 0} tone="low" />
          <SummaryCard label="Forældede pakker" value={summary?.outdated_count ?? 0} tone="neutral" />
          <SummaryCard label="CVE-poster" value={summary?.cve_count ?? 0} tone="neutral" />
        </div>
      </section>

      <section aria-labelledby="dep-outdated-heading">
        <h2 id="dep-outdated-heading" className="wire-card-title mb-3">
          Forældede pakker
        </h2>
        <div className="wire-table-wrap overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead>
              <tr className="wire-table-head border-b">
                <th className="px-3 py-2 font-semibold">Pakke</th>
                <th className="px-3 py-2 font-semibold">Nuværende</th>
                <th className="px-3 py-2 font-semibold">Seneste</th>
                <th className="px-3 py-2 font-semibold">Økosystem</th>
                <th className="px-3 py-2 font-semibold">Sti</th>
              </tr>
            </thead>
            <tbody>
              {report?.outdated_packages.length ? (
                report.outdated_packages.map((row) => (
                  <tr key={`${row.path}-${row.package}`} className="wire-table-row border-b">
                    <td className="px-3 py-2 font-medium">{row.package}</td>
                    <td className="px-3 py-2 tabular-nums">{row.version || "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{row.latest ?? "—"}</td>
                    <td className="px-3 py-2 uppercase">{row.ecosystem}</td>
                    <td className="text-muted-foreground px-3 py-2">{row.path}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-muted-foreground px-3 py-4">
                    Ingen forældede pakker registreret.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="dep-cve-heading">
        <h2 id="dep-cve-heading" className="wire-card-title mb-3">
          CVE / CVSS
        </h2>
        <div className="wire-table-wrap overflow-x-auto">
          <table className="w-full min-w-[42rem] text-left text-sm">
            <thead>
              <tr className="wire-table-head border-b">
                <th className="px-3 py-2 font-semibold">CVE</th>
                <th className="px-3 py-2 font-semibold">
                  <button type="button" className="hover:underline" onClick={() => toggleSort("package")}>
                    Pakke {sortKey === "package" ? (sortAsc ? "↑" : "↓") : ""}
                  </button>
                </th>
                <th className="px-3 py-2 font-semibold">
                  <button type="button" className="hover:underline" onClick={() => toggleSort("cvss_score")}>
                    CVSS {sortKey === "cvss_score" ? (sortAsc ? "↑" : "↓") : ""}
                  </button>
                </th>
                <th className="px-3 py-2 font-semibold">
                  <button type="button" className="hover:underline" onClick={() => toggleSort("severity")}>
                    Alvor {sortKey === "severity" ? (sortAsc ? "↑" : "↓") : ""}
                  </button>
                </th>
                <th className="px-3 py-2 font-semibold">Sti</th>
              </tr>
            </thead>
            <tbody>
              {sortedVulns.length ? (
                sortedVulns.map((row, idx) => {
                  const cve = row.cve_ids[0];
                  return (
                    <tr key={`${row.package}-${cve ?? idx}`} className="wire-table-row border-b">
                      <td className="px-3 py-2">
                        {cve ? (
                          <a
                            href={nvdUrl(cve)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-star-blue font-medium hover:underline"
                          >
                            {cve}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                        {row.cve_ids.length > 1 ? (
                          <span className="text-muted-foreground ml-1 text-xs">
                            +{row.cve_ids.length - 1}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 font-medium">{row.package}</td>
                      <td className="px-3 py-2 tabular-nums">
                        {row.cvss_score != null ? row.cvss_score.toFixed(1) : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold ${severityBadgeClass(row.severity, row.cvss_score)}`}
                        >
                          {severityBadgeLabel(row.severity, row.cvss_score)}
                        </span>
                      </td>
                      <td className="text-muted-foreground px-3 py-2">{row.path}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="text-muted-foreground px-3 py-4">
                    Ingen kendte sårbarheder i seneste audit.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="dep-modules-heading">
        <h2 id="dep-modules-heading" className="wire-card-title mb-3">
          Egne moduler
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          {report?.workspace_modules.map((mod) => (
            <div key={mod.id} className="wire-card">
              <h3 className="font-semibold">{mod.label}</h3>
              <p className="text-muted-foreground mt-1 text-xs">{mod.path}</p>
              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Økosystem</dt>
                  <dd className="uppercase">{mod.ecosystem}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Sårbarheder</dt>
                  <dd className="tabular-nums">{mod.vulnerability_count}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Forældede</dt>
                  <dd className="tabular-nums">{mod.outdated_count}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Sidst audit</dt>
                  <dd>{formatAuditTime(mod.last_audit_at)}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
