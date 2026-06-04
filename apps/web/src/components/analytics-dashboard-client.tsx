"use client";

import { useState, useEffect, useCallback } from "react";
import { apiGet } from "@/lib/api";
import { BubbleChart, type CategoryHotspot } from "@/components/analytics/bubble-chart";
import { IntakeHeatmap, type IntakeHeatmapCell } from "@/components/analytics/intake-heatmap";
import { RiskPredictor, type RiskTicket } from "@/components/analytics/risk-predictor";
import { StarSectionCard } from "@/components/star/section-card";
import { Button } from "@/components/ui/button";

interface AnalyticsResponse {
  hotspots: CategoryHotspot[];
  heatmap: IntakeHeatmapCell[];
  risk_tickets: RiskTicket[];
}

export function AnalyticsDashboardClient() {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiGet<AnalyticsResponse>("/api/v1/reports/analytics");
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke hente analysedata");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  return (
    <div className="space-y-8">
      <StarSectionCard
        variant="navy"
        title="Avanceret Sagsanalyse & Observability"
        description="STARdesk system-observabilitet: Kategori-hotspots baseret på kompleksitet og SLA, ugentligt sagsindtag og maskinlærings-baseret SLA-overskridelsesrisiko."
      >
        <div className="flex flex-wrap items-end gap-4">
          <Button
            type="button"
            className="bg-star-blue hover:bg-star-navy rounded-sm"
            onClick={loadAnalytics}
            disabled={loading}
          >
            {loading ? "Henter..." : "Opdater data"}
          </Button>
        </div>
      </StarSectionCard>

      {error && (
        <div className="p-4 rounded-sm border border-red-200 bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-star-blue border-t-transparent" />
          <p className="text-muted-foreground text-sm">Henter analysedata og genererer visualiseringer...</p>
        </div>
      )}

      {data && (
        <div className="space-y-8 animate-fade-in">
          {/* Bubble Chart Section */}
          <section aria-label="Kategori Hotspots">
            <BubbleChart hotspots={data.hotspots} />
          </section>

          {/* Heatmap and Risk Predictor Grid */}
          <div className="grid gap-8 lg:grid-cols-1">
            <section aria-label="Ugentlig Sagsindtag">
              <IntakeHeatmap heatmap={data.heatmap} />
            </section>

            <section aria-label="SLA Overskridelses-risiko">
              <RiskPredictor tickets={data.risk_tickets} />
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
