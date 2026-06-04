"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { buildTicketsFilterHref } from "@/lib/dashboard-ticket-links";

export interface CategoryHotspot {
  category_id: string | null;
  category_name_da: string;
  avg_complexity: number | null;
  sla_compliance_pct: number;
  open_count: number;
  avg_age_days: number;
  risk_level: string;
}

interface BubbleChartProps {
  hotspots: CategoryHotspot[];
}

export function BubbleChart({ hotspots }: BubbleChartProps) {
  const [hovered, setHovered] = useState<CategoryHotspot | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // SVG dimensions
  const width = 600;
  const height = 400;
  const padding = { top: 40, right: 40, bottom: 50, left: 60 };

  // Helper to map values to SVG coordinates
  const getX = (complexity: number | null) => {
    const val = complexity ?? 2.5; // Default if null
    const minX = 1;
    const maxX = 5;
    const chartWidth = width - padding.left - padding.right;
    return padding.left + ((val - minX) / (maxX - minX)) * chartWidth;
  };

  const getY = (compliance: number) => {
    const minY = 0;
    const maxY = 100;
    const chartHeight = height - padding.top - padding.bottom;
    // Invert Y for SVG coordinates
    return padding.top + chartHeight - ((compliance - minY) / (maxY - minY)) * chartHeight;
  };

  // Scale bubble radius based on open ticket count
  const getRadius = (count: number) => {
    if (count === 0) return 6;
    const maxCount = Math.max(1, ...hotspots.map((h) => h.open_count));
    const minRadius = 8;
    const maxRadius = 28;
    return minRadius + (count / maxCount) * (maxRadius - minRadius);
  };

  const getRiskColorClass = (level: string) => {
    switch (level) {
      case "critical":
        return {
          fill: "fill-red-500/80 hover:fill-red-500",
          stroke: "stroke-red-600",
          text: "text-red-600",
          bg: "bg-red-50 border-red-200",
        };
      case "high":
        return {
          fill: "fill-orange-500/80 hover:fill-orange-500",
          stroke: "stroke-orange-600",
          text: "text-orange-600",
          bg: "bg-orange-50 border-orange-200",
        };
      case "medium":
        return {
          fill: "fill-amber-500/80 hover:fill-amber-500",
          stroke: "stroke-amber-600",
          text: "text-amber-600",
          bg: "bg-amber-50 border-amber-200",
        };
      default:
        return {
          fill: "fill-emerald-500/80 hover:fill-emerald-500",
          stroke: "stroke-emerald-600",
          text: "text-emerald-600",
          bg: "bg-emerald-50 border-emerald-200",
        };
    }
  };

  const handleMouseMove = (e: React.MouseEvent, hotspot: CategoryHotspot) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setTooltipPos({
      x: e.clientX - rect.left + 15,
      y: e.clientY - rect.top - 10,
    });
    setHovered(hotspot);
  };

  return (
    <div className="star-section-card relative p-6" ref={containerRef}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-star-navy text-base font-bold">Kategori Hotspots (SLA vs. Kompleksitet)</h3>
          <p className="text-muted-foreground text-xs mt-1">
            Visualisering af sagsområder. Boblestørrelse angiver mængden af åbne sager.
          </p>
        </div>
        <div className="flex gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Lav risiko
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Medium
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-orange-500" /> Høj
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Kritisk
          </span>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-sm border border-slate-100 bg-slate-50/30">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto select-none"
          aria-label="Boblendiagram over sagsområder"
        >
          {/* Grid Lines */}
          {[20, 40, 60, 80, 100].map((tick) => (
            <g key={`grid-y-${tick}`}>
              <line
                x1={padding.left}
                y1={getY(tick)}
                x2={width - padding.right}
                y2={getY(tick)}
                className="stroke-slate-200"
                strokeDasharray="4 4"
              />
              <text
                x={padding.left - 10}
                y={getY(tick) + 4}
                textAnchor="end"
                className="fill-slate-400 text-[10px] font-medium"
              >
                {tick}%
              </text>
            </g>
          ))}

          {[1, 2, 3, 4, 5].map((tick) => (
            <g key={`grid-x-${tick}`}>
              <line
                x1={getX(tick)}
                y1={padding.top}
                x2={getX(tick)}
                y2={height - padding.bottom}
                className="stroke-slate-200"
                strokeDasharray="4 4"
              />
              <text
                x={getX(tick)}
                y={height - padding.bottom + 16}
                textAnchor="middle"
                className="fill-slate-400 text-[10px] font-medium"
              >
                {tick}.0
              </text>
            </g>
          ))}

          {/* Axis Lines */}
          <line
            x1={padding.left}
            y1={height - padding.bottom}
            x2={width - padding.right}
            y2={height - padding.bottom}
            className="stroke-slate-300"
            strokeWidth="1.5"
          />
          <line
            x1={padding.left}
            y1={padding.top}
            x2={padding.left}
            y2={height - padding.bottom}
            className="stroke-slate-300"
            strokeWidth="1.5"
          />

          {/* Axis Labels */}
          <text
            x={(width - padding.left - padding.right) / 2 + padding.left}
            y={height - 12}
            textAnchor="middle"
            className="fill-star-navy text-xs font-semibold"
          >
            Gennemsnitlig kompleksitet (1 = Simpel, 5 = Kompleks)
          </text>

          <text
            transform={`rotate(-90, 15, ${(height - padding.top - padding.bottom) / 2 + padding.top})`}
            x={15}
            y={(height - padding.top - padding.bottom) / 2 + padding.top}
            textAnchor="middle"
            className="fill-star-navy text-xs font-semibold"
          >
            SLA-overholdelse (%)
          </text>

          {/* Bubbles */}
          {hotspots.map((hotspot) => {
            const cx = getX(hotspot.avg_complexity);
            const cy = getY(hotspot.sla_compliance_pct);
            const r = getRadius(hotspot.open_count);
            const colors = getRiskColorClass(hotspot.risk_level);

            return (
              <g key={hotspot.category_id || "unclassified"}>
                {hotspot.category_id ? (
                  <Link
                    href={buildTicketsFilterHref({
                      scope: "all",
                      openOnly: true,
                    }) + `&category_id=${hotspot.category_id}`}
                    className="cursor-pointer focus:outline-none"
                  >
                    <circle
                      cx={cx}
                      cy={cy}
                      r={r}
                      className={`${colors.fill} ${colors.stroke} transition-all duration-150`}
                      strokeWidth="1.5"
                      onMouseMove={(e) => handleMouseMove(e, hotspot)}
                      onMouseLeave={() => setHovered(null)}
                    />
                  </Link>
                ) : (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={r}
                    className={`${colors.fill} ${colors.stroke} transition-all duration-150`}
                    strokeWidth="1.5"
                    onMouseMove={(e) => handleMouseMove(e, hotspot)}
                    onMouseLeave={() => setHovered(null)}
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Floating Tooltip */}
      {hovered && (
        <div
          className={`absolute z-10 rounded-sm border bg-white p-3 shadow-lg pointer-events-none transition-opacity duration-150 w-56 ${
            getRiskColorClass(hovered.risk_level).bg
          }`}
          style={{ left: tooltipPos.x, top: tooltipPos.y }}
        >
          <p className="text-star-navy font-bold text-xs border-b pb-1 mb-1.5">
            {hovered.category_name_da}
          </p>
          <div className="space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span className="text-muted-foreground">SLA-overholdelse:</span>
              <span className="font-semibold text-star-navy">{hovered.sla_compliance_pct}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Kompleksitet:</span>
              <span className="font-semibold text-star-navy">
                {hovered.avg_complexity != null ? `${hovered.avg_complexity.toFixed(1)}/5` : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Åbne sager (backlog):</span>
              <span className="font-semibold text-star-navy">{hovered.open_count}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Gns. alder (åbne):</span>
              <span className="font-semibold text-star-navy">{hovered.avg_age_days} dage</span>
            </div>
            <div className="flex justify-between mt-1 pt-1 border-t border-slate-200/50">
              <span className="text-muted-foreground">Risikoniveau:</span>
              <span className={`font-bold uppercase tracking-wider text-[9px] ${getRiskColorClass(hovered.risk_level).text}`}>
                {hovered.risk_level === "critical"
                  ? "Kritisk"
                  : hovered.risk_level === "high"
                    ? "Høj"
                    : hovered.risk_level === "medium"
                      ? "Medium"
                      : "Lav"}
              </span>
            </div>
          </div>
          {hovered.category_id && (
            <p className="text-[9px] text-muted-foreground mt-2 text-center italic">
              Klik for at se åbne sager
            </p>
          )}
        </div>
      )}
    </div>
  );
}
