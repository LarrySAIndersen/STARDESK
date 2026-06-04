"use client";

import { useEffect, useState, useCallback } from "react";
import { apiGet } from "@/lib/api";
import { StarSectionCard } from "@/components/star/section-card";
import { Button } from "@/components/ui/button";
import type { PredefinedReportsResponse } from "@/types/report";
import { fireAndForget } from "@/lib/fire-and-forget";

export function PredefinedReports() {
  const [data, setData] = useState<PredefinedReportsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPredefined = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiGet<PredefinedReportsResponse>("/api/v1/reports/predefined");
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke hente brancherapporter");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fireAndForget(loadPredefined());
  }, [loadPredefined]);

  return (
    <div className="space-y-8">
      <StarSectionCard
        variant="navy"
        title="Branche-standarder & ITIL KPI'er"
        description="Prædefinerede rapporter baseret på ITIL-standarder og service desk-best practices. Giver overblik over SLA-overholdelse, MTTR (løsningstid), FCR (førstekontakt) og sagstyper."
      >
        <div className="flex flex-wrap items-end gap-4">
          <Button
            type="button"
            className="bg-star-blue hover:bg-star-navy rounded-sm"
            onClick={() => fireAndForget(loadPredefined())}
            disabled={loading}
          >
            {loading ? "Opdaterer..." : "Opdater KPI-data"}
          </Button>
        </div>
      </StarSectionCard>

      {error && (
        <div className="p-4 rounded-sm border border-star-red/20 bg-red-50 text-star-red text-sm" role="alert">
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-star-blue border-t-transparent" />
          <p className="text-muted-foreground text-sm" aria-live="polite">Beregner branchestandarder og genererer nøgletal...</p>
        </div>
      )}

      {data && (
        <div className="grid gap-6 md:grid-cols-2">
          {data.sections.map((section, idx) => (
            <div
              key={idx}
              className="ledger-card border-t-4 border-t-star-blue p-6 bg-white flex flex-col justify-between space-y-4"
            >
              <div>
                <h3 className="text-star-navy text-lg font-bold">{section.title_da}</h3>
                <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                  {section.description_da}
                </p>
                <div className="mt-6 space-y-4">
                  {section.items.length === 0 ? (
                    <p className="text-muted-foreground text-xs italic">Ingen data tilgængelig.</p>
                  ) : (
                    section.items.map((item, itemIdx) => {
                      // Determine progress bar color based on metric
                      let progressColor = "bg-star-blue";
                      if (section.title_da.includes("SLA")) {
                        if (item.metric_value < 60) progressColor = "bg-star-red";
                        else if (item.metric_value < 85) progressColor = "bg-amber-500";
                        else progressColor = "bg-emerald-600";
                      } else if (section.title_da.includes("Første")) {
                        if (item.metric_value < 50) progressColor = "bg-amber-500";
                        else progressColor = "bg-emerald-600";
                      }

                      return (
                        <div key={itemIdx} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-star-navy font-semibold">{item.label_da}</span>
                            <span className="text-muted-foreground tabular-nums">
                              {item.metric_label_da} ({item.count} {item.count === 1 ? "sag" : "sager"})
                            </span>
                          </div>
                          
                          {/* Render Progress Bar if percentage or metric value is percentage */}
                          {(item.percentage != null || section.title_da.includes("SLA") || section.title_da.includes("Første")) && (
                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
                                style={{
                                  width: `${Math.min(
                                    item.percentage != null ? item.percentage : item.metric_value,
                                    100
                                  )}%`,
                                }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 flex justify-between items-center text-[10px] text-muted-foreground">
                <span>Nøgletal: {section.metric_name_da}</span>
                <span>Opdateret i dag</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {data && (
        <p className="text-muted-foreground text-[10px]">
          Alle tal er beregnet i realtid på tværs af tilgængelige sager. Sidst opdateret: {new Date(data.generated_at).toLocaleString("da-DK")}
        </p>
      )}
    </div>
  );
}
