"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Globe2, ZoomIn, ZoomOut } from "lucide-react";

import {
  buildAssetGraph,
  clearGraphLayout,
  filterGraphByVisibility,
  getDefaultNodePositions,
  getGraphNeighborIds,
  loadGraphLayout,
  mergeNodePositions,
  saveGraphLayout,
} from "@/lib/asset-graph";
import { cn } from "@/lib/utils";
import type { AssetGraphLayout } from "@/lib/asset-graph";
import type { AssetGraphNode } from "@/types/asset";

const VIEWBOX = { w: 1000, h: 760 };
const MIN_ZOOM = 0.55;
const MAX_ZOOM = 2.2;
const LAYOUT_SAVED_MS = 2200;

interface AssetGraphNetworkProps {
  selectedId: string | null;
  onSelect: (assetId: string) => void;
  visibleIds: Set<string>;
}

function truncateLabel(label: string, maxLen: number): string {
  if (label.length <= maxLen) return label;
  return `${label.slice(0, maxLen - 1)}…`;
}

function nodeById(nodes: AssetGraphNode[], id: string): AssetGraphNode | undefined {
  return nodes.find((n) => n.id === id);
}

function clientToSvg(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const svgPt = pt.matrixTransform(ctm.inverse());
  return { x: svgPt.x, y: svgPt.y };
}

export function AssetGraphNetwork({ selectedId, onSelect, visibleIds }: AssetGraphNetworkProps) {
  const baseGraph = useMemo(() => buildAssetGraph(), []);
  const graph = useMemo(
    () => filterGraphByVisibility(baseGraph, visibleIds),
    [baseGraph, visibleIds],
  );

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panDragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const nodeDragRef = useRef<{
    nodeId: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const nodeDragMovedRef = useRef(false);

  const [positions, setPositions] = useState<AssetGraphLayout>(() =>
    mergeNodePositions(baseGraph, null),
  );
  const [layoutSaved, setLayoutSaved] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setPositions(mergeNodePositions(baseGraph, loadGraphLayout()));
  }, [baseGraph]);

  const positionedNodes = useMemo(() => {
    return graph.nodes.map((node) => {
      const pos = positions[node.id];
      return pos ? { ...node, x: pos.x, y: pos.y } : node;
    });
  }, [graph.nodes, positions]);

  const highlightIds = useMemo(() => {
    if (!selectedId) return new Set<string>();
    const ids = new Set<string>([selectedId]);
    getGraphNeighborIds(selectedId, graph.edges).forEach((id) => ids.add(id));
    return ids;
  }, [selectedId, graph.edges]);

  const persistLayout = useCallback((layout: AssetGraphLayout) => {
    saveGraphLayout(layout);
    setLayoutSaved(true);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => setLayoutSaved(false), LAYOUT_SAVED_MS);
  }, []);

  const handleWheel = useCallback((event: React.WheelEvent) => {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.08 : 0.08;
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z + delta)));
  }, []);

  const handleCanvasPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (event.button !== 0 || nodeDragRef.current) return;
      panDragRef.current = {
        x: event.clientX,
        y: event.clientY,
        panX: pan.x,
        panY: pan.y,
      };
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    },
    [pan.x, pan.y],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent) => {
      const nodeDrag = nodeDragRef.current;
      const svg = svgRef.current;
      if (nodeDrag && svg) {
        nodeDragMovedRef.current = true;
        const pt = clientToSvg(svg, event.clientX, event.clientY);
        setPositions((prev) => {
          const next = {
            ...prev,
            [nodeDrag.nodeId]: {
              x: pt.x - nodeDrag.offsetX,
              y: pt.y - nodeDrag.offsetY,
            },
          };
          return next;
        });
        return;
      }

      const panDrag = panDragRef.current;
      if (!panDrag) return;
      setPan({
        x: panDrag.panX + (event.clientX - panDrag.x),
        y: panDrag.panY + (event.clientY - panDrag.y),
      });
    },
    [],
  );

  const handlePointerUp = useCallback(() => {
    if (nodeDragRef.current) {
      setPositions((current) => {
        persistLayout(current);
        return current;
      });
    }
    nodeDragRef.current = null;
    panDragRef.current = null;
  }, [persistLayout]);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const resetLayout = useCallback(() => {
    const defaults = getDefaultNodePositions(baseGraph);
    setPositions(defaults);
    clearGraphLayout();
    setLayoutSaved(false);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
  }, [baseGraph]);

  const startNodeDrag = useCallback(
    (event: React.PointerEvent, node: AssetGraphNode) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      const svg = svgRef.current;
      if (!svg) return;
      panDragRef.current = null;
      nodeDragMovedRef.current = false;
      const pt = clientToSvg(svg, event.clientX, event.clientY);
      nodeDragRef.current = {
        nodeId: node.id,
        offsetX: pt.x - node.x,
        offsetY: pt.y - node.y,
      };
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  return (
    <div className="wire-asset-graph flex min-h-0 flex-1 flex-col">
      <div className="wire-asset-panel-header">
        <Globe2 className="size-3.5 shrink-0 opacity-70" aria-hidden />
        <span>Verdenskort</span>
        {layoutSaved ? (
          <span className="wire-asset-graph-saved" role="status">
            Layout gemt
          </span>
        ) : null}
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
          <button
            type="button"
            className="wire-asset-graph-reset"
            onClick={resetView}
            title="Nulstil pan og zoom"
          >
            Centrer
          </button>
          <button
            type="button"
            className="wire-asset-graph-reset"
            onClick={resetLayout}
            title="Gendan standardplacering af bobler"
          >
            Nulstil
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="wire-asset-graph-canvas min-h-0 flex-1"
        onWheel={handleWheel}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        role="img"
        aria-label="Netværk af STAR-aktiver. Træk bobler for at flytte dem. Klik for detaljer."
      >
        <svg
          ref={svgRef}
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
              const source = nodeById(positionedNodes, edge.source);
              const target = nodeById(positionedNodes, edge.target);
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
            {positionedNodes.map((node) => {
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
                  onPointerDown={(e) => startNodeDrag(e, node)}
                  onClick={() => {
                    if (nodeDragMovedRef.current) {
                      nodeDragMovedRef.current = false;
                      return;
                    }
                    onSelect(node.id);
                  }}
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

        {graph.nodes.length === 0 ? (
          <p className="wire-asset-graph-hint">Vælg aktiver i listen for at vise dem på kortet</p>
        ) : !selectedId ? (
          <p className="wire-asset-graph-hint">Klik på en boble for at udforske forbindelser</p>
        ) : null}
      </div>
    </div>
  );
}
