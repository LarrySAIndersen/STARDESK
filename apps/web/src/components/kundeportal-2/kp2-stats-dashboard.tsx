"use client";

import { useMemo, useState } from "react";

import { KP2_MONTHLY_STATS } from "@/lib/kundeportal-2/mock-data";

type ViewMode = "maaned" | "aar";

export function Kp2StatsDashboard({ initialView = "maaned" }: { initialView?: ViewMode }) {
  const [view, setView] = useState<ViewMode>(initialView);
  const [showChart, setShowChart] = useState(true);

  const chartData = useMemo(() => {
    if (view === "aar") {
      const byYear = new Map<string, { registered: number; resolved: number }>();
      for (const row of KP2_MONTHLY_STATS) {
        const year = row.period.slice(0, 4);
        const cur = byYear.get(year) ?? { registered: 0, resolved: 0 };
        cur.registered += row.registeredSecondLine;
        cur.resolved += row.resolvedSecondLine;
        byYear.set(year, cur);
      }
      return Array.from(byYear.entries()).map(([year, vals]) => ({
        period: year,
        registered: vals.registered,
        resolved: vals.resolved,
      }));
    }
    return KP2_MONTHLY_STATS.map((row) => ({
      period: row.period,
      registered: row.registeredSecondLine,
      resolved: row.resolvedSecondLine,
    }));
  }, [view]);

  const maxVal = Math.max(...chartData.flatMap((r) => [r.registered, r.resolved]), 1);

  return (
    <div className="portal-v2-page mx-auto w-full max-w-5xl space-y-6 pb-10">
      <header>
        <h1 className="kp2-page-title">Sagsstatistik</h1>
        <p className="text-muted-foreground text-sm">
          Opgørelse af sager pr. {view === "aar" ? "år" : "måned"} (Second Line).
        </p>
      </header>

      <div className="kp2-toolbar">
        <div className="flex gap-2">
          <button
            type="button"
            className={view === "maaned" ? "kp2-btn-primary" : "kp2-btn-secondary"}
            onClick={() => setView("maaned")}
          >
            Sager - Måned
          </button>
          <button
            type="button"
            className={view === "aar" ? "kp2-btn-primary" : "kp2-btn-secondary"}
            onClick={() => setView("aar")}
          >
            Sager - År
          </button>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showChart} onChange={(e) => setShowChart(e.target.checked)} />
          Vis søjlediagram
        </label>
      </div>

      {showChart ? (
        <div className="kp2-card space-y-3 p-4" role="img" aria-label="Søjlediagram over sager">
          {chartData.map((row) => (
            <div key={row.period} className="space-y-1">
              <p className="text-xs font-medium">{row.period}</p>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-28 shrink-0">Registreret</span>
                  <div className="bg-muted h-3 flex-1 overflow-hidden rounded">
                    <div
                      className="kp2-bar-reg h-full"
                      style={{ width: `${(row.registered / maxVal) * 100}%` }}
                    />
                  </div>
                  <span>{row.registered}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-28 shrink-0">Løst</span>
                  <div className="bg-muted h-3 flex-1 overflow-hidden rounded">
                    <div
                      className="kp2-bar-res h-full"
                      style={{ width: `${(row.resolved / maxVal) * 100}%` }}
                    />
                  </div>
                  <span>{row.resolved}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="kp2-card overflow-hidden">
        <table className="kp2-table">
          <thead>
            <tr>
              <th>Periode</th>
              <th>Registreret Second Line</th>
              <th>Løst Second Line</th>
            </tr>
          </thead>
          <tbody>
            {chartData.map((row) => (
              <tr key={row.period}>
                <td>{row.period}</td>
                <td>{row.registered}</td>
                <td>{row.resolved}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
