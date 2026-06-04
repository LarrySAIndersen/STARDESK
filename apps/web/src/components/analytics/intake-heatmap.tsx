"use client";

import { useState, useRef } from "react";

export interface IntakeHeatmapCell {
  day_of_week: number;
  hour_of_day: number;
  count: number;
}

interface IntakeHeatmapProps {
  heatmap: IntakeHeatmapCell[];
}

const DAYS_DA = [
  { value: 1, label: "Mandag" },
  { value: 2, label: "Tirsdag" },
  { value: 3, label: "Onsdag" },
  { value: 4, label: "Torsdag" },
  { value: 5, label: "Fredag" },
  { value: 6, label: "Lørdag" },
  { value: 7, label: "Søndag" },
];

export function IntakeHeatmap({ heatmap }: IntakeHeatmapProps) {
  const [hovered, setHovered] = useState<IntakeHeatmapCell | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const maxCount = Math.max(1, ...heatmap.map((c) => c.count));

  const handleMouseMove = (e: React.MouseEvent, cell: IntakeHeatmapCell) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setTooltipPos({
      x: e.clientX - rect.left + 15,
      y: e.clientY - rect.top - 10,
    });
    setHovered(cell);
  };

  // Find cell for a specific day and hour
  const getCell = (day: number, hour: number) => {
    return (
      heatmap.find((c) => c.day_of_week === day && c.hour_of_day === hour) ?? {
        day_of_week: day,
        hour_of_day: hour,
        count: 0,
      }
    );
  };

  const getDayLabel = (dayNum: number) => {
    return DAYS_DA.find((d) => d.value === dayNum)?.label ?? "";
  };

  return (
    <div className="star-section-card relative p-6" ref={containerRef}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-star-navy text-base font-bold">Ugentlig Sagsindtag (Heatmap)</h3>
          <p className="text-muted-foreground text-xs mt-1">
            Fordeling af oprettede sager på ugedage og timer. Mørkere farve indikerer højere aktivitet.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Lav</span>
          <div className="flex h-3 w-24 rounded-sm overflow-hidden border border-slate-200">
            <div className="flex-1" style={{ backgroundColor: "rgba(0, 86, 179, 0.1)" }} />
            <div className="flex-1" style={{ backgroundColor: "rgba(0, 86, 179, 0.4)" }} />
            <div className="flex-1" style={{ backgroundColor: "rgba(0, 86, 179, 0.7)" }} />
            <div className="flex-1" style={{ backgroundColor: "rgba(0, 86, 179, 1.0)" }} />
          </div>
          <span>Høj</span>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto pb-2">
        <div className="min-w-[760px]">
          {/* Header row for hours */}
          <div className="flex items-center mb-1">
            <div className="w-20 text-xs text-slate-400 font-medium text-right pr-4" />
            <div className="flex-1 gap-1" style={{ display: "grid", gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}>
              {Array.from({ length: 24 }).map((_, hour) => (
                <div
                  key={`hour-header-${hour}`}
                  className="text-[10px] text-slate-400 font-semibold text-center"
                >
                  {hour % 2 === 0 ? `${String(hour).padStart(2, "0")}` : ""}
                </div>
              ))}
            </div>
          </div>

          {/* Grid rows for days */}
          <div className="space-y-1">
            {DAYS_DA.map((day) => (
              <div key={`day-row-${day.value}`} className="flex items-center">
                <div className="w-20 text-xs text-star-navy font-semibold text-right pr-4">
                  {day.label.substring(0, 3)}
                </div>
                <div className="flex-1 gap-1" style={{ display: "grid", gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}>
                  {Array.from({ length: 24 }).map((_, hour) => {
                    const cell = getCell(day.value, hour);
                    const isZero = cell.count === 0;
                    const bgStyle = isZero
                      ? { backgroundColor: "#f8fafc" }
                      : {
                          backgroundColor: `rgba(0, 86, 179, ${0.15 + 0.85 * (cell.count / maxCount)})`,
                        };

                    return (
                      <div
                        key={`cell-${day.value}-${hour}`}
                        className="aspect-square rounded-[2px] border border-slate-100/50 transition-all duration-100 hover:scale-110 hover:border-star-navy/30 cursor-crosshair"
                        style={bgStyle}
                        onMouseMove={(e) => handleMouseMove(e, cell)}
                        onMouseLeave={() => setHovered(null)}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* X-axis label spacer */}
          <div className="flex items-center mt-2">
            <div className="w-20" />
            <div className="flex-1 flex justify-between px-2 text-[10px] text-slate-400 font-medium">
              <span>00:00 (Nat)</span>
              <span>06:00 (Morgen)</span>
              <span>12:00 (Middag)</span>
              <span>18:00 (Aften)</span>
              <span>23:00 (Nat)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Tooltip */}
      {hovered && (
        <div
          className="absolute z-10 rounded-sm border border-slate-200 bg-white px-2.5 py-1.5 shadow-md pointer-events-none transition-opacity duration-150 text-xs text-star-navy font-medium"
          style={{ left: tooltipPos.x, top: tooltipPos.y }}
        >
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-muted-foreground">
              {getDayLabel(hovered.day_of_week)} kl. {String(hovered.hour_of_day).padStart(2, "0")}:00
            </span>
            <span>
              {hovered.count} {hovered.count === 1 ? "sag oprettet" : "sager oprettet"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
