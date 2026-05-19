"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Globe2, ZoomIn, ZoomOut } from "lucide-react";

import { buildAssetGraph, getGraphNeighborIds } from "@/lib/asset-graph";
import { cn } from "@/lib/utils";
import type { AssetGraphNode } from "@/types/asset";

const VIEWBOX = { w: 1000, h: 760 };
const MIN_ZOOM = 0.55;
const MAX_ZOOM = 2.2;

interface AssetGraphNetworkProps {
  selectedId: string | null;
  onSelect: (assetId: string) => void;
}

function truncateLabel(label: string, maxLen: number): string {
  if (label.length <= maxLen) return label;
  return `${label.slice(0, maxLen - 1)}…`;
}

function nodeById(nodes: AssetGraphNode[], id: string): AssetGraphNode | undefined {
  return nodes.find((n) => n.id === id);
}

export function AssetGraphNetwork({ selectedId, onSelect }: AssetGraphNetworkProps) {
  const graph = useMemo(() => buildAssetGraph(), []);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const highlightIds = useMemo(() => {
    if (!selectedId) return new Set<string>();
    const ids = new Set<string>([selectedId]);
    getGraphNeighborIds(selectedId, graph.edges).forEach((id) => ids.add(id));
    return ids;
  }, [selectedId, graph.edges]);

  const handleWheel = useCallback((event: React.WheelEvent) => {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.08 : 0.08;
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z + delta)));
  }, []);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (event.button !== 0) return;
      dragRef.current = {
        x: event.clientX,
        y: event.clientY,
        panX: pan.x,
        panY: pan.y,
      };
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    },
    [pan.x, pan.y],
  );

  const handlePointerMove = useCallback((event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    setPan({
      x: drag.panX + (event.clientX - drag.x),
      y: drag.panY + (event.clientY - drag.y),
    });
  }, []);

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  return (
    <div className="wire-asset-graph flex min-h-0 flex-1 flex-col">
      <div className="wire-asset-panel-header">
        <Globe2 className="size-3.5 shrink-0 opacity-70" aria-hidden />
        <span>Verdenskort</span>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            className="wire-asset-graph-zoom-btn"
            onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 0.15))}
            aria-label="Zoom ind"
          >
            <ZoomIn className="size-3.5" aria-hidden />
          </button>
          <button
            type="button"
            className="wire-asset-graph-zoom-btn"
            onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - 0.15))}
            aria-label="Zoom ud"
          >
            <ZoomOut className="size-3.5" aria-hidden />
          </button>
          <button type="button" className="wire-asset-graph-reset" onClick={resetView}>
            Nulstil
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="wire-asset-graph-canvas min-h-0 flex-1"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        role="img"
        aria-label="Netværk af STAR-aktiver. Klik på en boble for detaljer."
      >
        <svg
          className="wire-asset-graph-svg"
          viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`}
          preserveAspectRatio="xMidYMid meet"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center center",
          }}
        >
          <defs>
            <radialGradient id="wire-bubble-system" cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="var(--star-blue-light)" />
              <stop offset="100%" stopColor="var(--star-navy)" />
            </radialGradient>
            <radialGradient id="wire-bubble-sub" cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="var(--star-blue)" />
            </radialGradient>
          </defs>

          <g className="wire-asset-graph-edges">
            {graph.edges.map((edge) => {
              const source = nodeById(graph.nodes, edge.source);
              const target = nodeById(graph.nodes, edge.target);
              if (!source || !target) return null;

              const active =
                selectedId && (edge.source === selectedId || edge.target === selectedId);

              const dimmed = selectedId && !active;

              return (
                <line
                  key={edge.id}
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  className={cn(
                    "wire-asset-graph-edge",
                    active && "wire-asset-graph-edge--active",
                    dimmed && "wire-asset-graph-edge--dim",
                  )}
                />
              );
            })}
          </g>

          <g className="wire-asset-graph-nodes">
            {graph.nodes.map((node) => {
              const isSelected = node.id === selectedId;
              const isNeighbor = highlightIds.has(node.id) && !isSelected;
              const dimmed = selectedId && !highlightIds.has(node.id);
              const isSystem = node.kind === "system";
              const maxLabel = isSystem ? 14 : 11;

              return (
                <g
                  key={node.id}
                  className={cn(
                    "wire-asset-graph-node",
                    isSystem ? "wire-asset-graph-node--system" : "wire-asset-graph-node--sub",
                    isSelected && "wire-asset-graph-node--selected",
                    isNeighbor && "wire-asset-graph-node--neighbor",
                    dimmed && "wire-asset-graph-node--dim",
                  )}
                  transform={`translate(${node.x}, ${node.y})`}
                  onClick={() => onSelect(node.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(node.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  aria-label={node.label}
                  style={{ cursor: "pointer" }}
                >
                  <circle
                    r={node.radius}
                    className="wire-asset-graph-bubble"
                    fill={isSystem ? "url(#wire-bubble-system)" : "url(#wire-bubble-sub)"}
                  />
                  <text
                    className="wire-asset-graph-label"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    y={isSystem ? 1 : 0}
                  >
                    {truncateLabel(node.label, maxLabel)}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {!selectedId ? (
          <p className="wire-asset-graph-hint">Klik på en boble for at udforske forbindelser</p>
        ) : null}
      </div>
    </div>
  );
}
