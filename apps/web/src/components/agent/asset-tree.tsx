"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight, Layers, Plus } from "lucide-react";

import { useAssetCatalog } from "@/components/agent/asset-catalog-context";
import { getAllAssetIds, getSystemVisibilityState } from "@/lib/asset-graph";
import { getCategoryTheme } from "@/lib/mock-assets";
import { cn } from "@/lib/utils";
import type { AssetSelection, AssetSubsystem, AssetSystem } from "@/types/asset";

function VisibilityCheckbox({
  checked,
  indeterminate,
  label,
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <label className="wire-asset-visibility" title={label}>
      <input
        type="checkbox"
        className="wire-asset-visibility-input"
        checked={checked}
        ref={(el) => {
          if (el) el.indeterminate = Boolean(indeterminate);
        }}
        onChange={(e) => {
          e.stopPropagation();
          onChange();
        }}
        onClick={(e) => e.stopPropagation()}
        aria-label={label}
      />
    </label>
  );
}

function selectionKey(selection: AssetSelection | null): string | null {
  if (!selection) return null;
  return selection.kind === "system"
    ? selection.system.id
    : selection.subsystem.id;
}

function resolveSelection(
  assetId: string,
  systems: AssetSystem[],
): AssetSelection | null {
  for (const system of systems) {
    if (system.id === assetId) {
      return { kind: "system", system };
    }
    const subsystem = system.subsystems.find((s) => s.id === assetId);
    if (subsystem) {
      return { kind: "subsystem", system, subsystem };
    }
  }
  return null;
}

export function AssetTree({
  showHeader = true,
  selectedId: controlledId,
  onSelect,
  compact = false,
  visibleIds,
  onVisibilityChange,
  allVisible = true,
  onAddClick,
}: {
  showHeader?: boolean;
  selectedId?: string | null;
  onSelect?: (assetId: string) => void;
  compact?: boolean;
  visibleIds?: Set<string>;
  onVisibilityChange?: (next: Set<string>) => void;
  allVisible?: boolean;
  onAddClick?: () => void;
}) {
  const { systems } = useAssetCatalog();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const assetFromUrl = searchParams.get("asset_id");

  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const system of systems) {
      initial[system.id] = true;
    }
    return initial;
  });

  const [selection, setSelection] = useState<AssetSelection | null>(() => {
    if (controlledId) return resolveSelection(controlledId, systems);
    if (!assetFromUrl) return null;
    return resolveSelection(assetFromUrl, systems);
  });

  const activeId = useMemo(() => {
    if (controlledId !== undefined) return controlledId ?? assetFromUrl;
    return selectionKey(selection) ?? assetFromUrl;
  }, [controlledId, selection, assetFromUrl]);

  useEffect(() => {
    setExpanded((prev) => {
      const next = { ...prev };
      for (const system of systems) {
        if (!(system.id in next)) next[system.id] = true;
      }
      return next;
    });
  }, [systems]);

  const toggleExpanded = useCallback((systemId: string) => {
    setExpanded((prev) => ({ ...prev, [systemId]: !prev[systemId] }));
  }, []);

  const selectSystem = useCallback(
    (system: AssetSystem) => {
      if (onSelect) {
        onSelect(system.id);
        return;
      }
      setSelection({ kind: "system", system });
    },
    [onSelect],
  );

  const selectSubsystem = useCallback(
    (system: AssetSystem, subsystem: AssetSubsystem) => {
      if (onSelect) {
        onSelect(subsystem.id);
        return;
      }
      setSelection({ kind: "subsystem", system, subsystem });
    },
    [onSelect],
  );

  const applyAssetFilter = useCallback(() => {
    const id = activeId;
    if (!id) return;
    const params = new URLSearchParams();
    params.set("asset_id", id);
    router.push(`/tickets?${params.toString()}`);
  }, [router, activeId]);

  const resolvedSelection = useMemo(() => {
    if (controlledId) return resolveSelection(controlledId, systems);
    return selection;
  }, [controlledId, selection, systems]);

  const detailLabel =
    resolvedSelection?.kind === "subsystem"
      ? `${resolvedSelection.system.name} › ${resolvedSelection.subsystem.name}`
      : resolvedSelection?.kind === "system"
        ? resolvedSelection.system.name
        : null;

  const detailCode =
    resolvedSelection?.kind === "subsystem"
      ? resolvedSelection.subsystem.code
      : resolvedSelection?.kind === "system"
        ? resolvedSelection.system.code
        : null;

  const graphMode = Boolean(visibleIds && onVisibilityChange);

  const toggleAssetVisibility = useCallback(
    (assetId: string) => {
      if (!visibleIds || !onVisibilityChange) return;
      const next = new Set(visibleIds);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      onVisibilityChange(next);
    },
    [visibleIds, onVisibilityChange],
  );

  const toggleSystemVisibility = useCallback(
    (system: AssetSystem) => {
      if (!visibleIds || !onVisibilityChange) return;
      const state = getSystemVisibilityState(system.id, visibleIds, systems);
      const next = new Set(visibleIds);
      const ids = [system.id, ...system.subsystems.map((s) => s.id)];
      if (state === "all") {
        for (const id of ids) next.delete(id);
      } else {
        for (const id of ids) next.add(id);
      }
      onVisibilityChange(next);
    },
    [visibleIds, onVisibilityChange, systems],
  );

  const showAllOnGraph = useCallback(() => {
    onVisibilityChange?.(new Set(getAllAssetIds(systems)));
  }, [onVisibilityChange, systems]);

  return (
    <div className="flex min-h-0 flex-1 flex-col" aria-label="Aktiver">
      {showHeader ? (
        <div className="wire-asset-panel-header">
          <Layers className="size-3.5 shrink-0 opacity-70" aria-hidden />
          <span>Aktiver</span>
          <div className="ml-auto flex items-center gap-1">
            {onAddClick ? (
              <button
                type="button"
                className="wire-asset-graph-toggle px-1.5 py-0.5 text-[9px]"
                onClick={onAddClick}
              >
                <Plus className="size-3" aria-hidden />
                Tilføj
              </button>
            ) : null}
            {graphMode ? (
              <button
                type="button"
                className="wire-asset-show-all text-[9px] font-semibold uppercase tracking-wide"
                onClick={showAllOnGraph}
                disabled={allVisible}
              >
                Vis alle
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="wire-asset-tree min-h-0 flex-1 overflow-y-auto">
        <ul className="m-0 list-none p-0" role="tree">
          {systems.map((system) => {
            const isOpen = expanded[system.id] ?? false;
            const systemSelected = activeId === system.id;
            const systemVis = graphMode
              ? getSystemVisibilityState(system.id, visibleIds!, systems)
              : "all";
            const systemOnGraph = systemVis !== "none";
            const categoryTheme = getCategoryTheme(system.id);

            return (
              <li
                key={system.id}
                role="treeitem"
                aria-expanded={isOpen}
                aria-selected={systemSelected}
                className="wire-asset-category-group"
                style={
                  {
                    "--wire-asset-category-color": categoryTheme.base,
                    "--wire-asset-category-muted": categoryTheme.muted,
                  } as CSSProperties
                }
              >
                <div className="flex min-w-0 items-stretch">
                  <span className="wire-asset-category-marker" aria-hidden />
                  <button
                    type="button"
                    className="wire-asset-expand"
                    onClick={() => toggleExpanded(system.id)}
                    aria-label={isOpen ? "Skjul undersystemer" : "Vis undersystemer"}
                  >
                    {isOpen ? (
                      <ChevronDown className="size-3.5" aria-hidden />
                    ) : (
                      <ChevronRight className="size-3.5" aria-hidden />
                    )}
                  </button>
                  {graphMode ? (
                    <VisibilityCheckbox
                      checked={systemVis === "all"}
                      indeterminate={systemVis === "some"}
                      label={`Vis ${system.name} på kortet`}
                      onChange={() => toggleSystemVisibility(system)}
                    />
                  ) : null}
                  <button
                    type="button"
                    className={cn(
                      "wire-asset-row wire-asset-row--system",
                      systemSelected && "wire-asset-row--active",
                      graphMode && !systemOnGraph && "wire-asset-row--hidden",
                    )}
                    onClick={() => selectSystem(system)}
                  >
                    {system.name}
                  </button>
                </div>
                {isOpen ? (
                  <ul className="m-0 list-none p-0" role="group">
                    {system.subsystems.map((sub) => {
                      const subSelected = activeId === sub.id;
                      const subVisible = !graphMode || visibleIds!.has(sub.id);
                      return (
                        <li key={sub.id} role="treeitem" aria-selected={subSelected}>
                          <div className="flex min-w-0 items-stretch">
                            {graphMode ? (
                              <span className="wire-asset-expand-spacer" aria-hidden />
                            ) : null}
                            {graphMode ? (
                              <VisibilityCheckbox
                                checked={subVisible}
                                label={`Vis ${sub.name} på kortet`}
                                onChange={() => toggleAssetVisibility(sub.id)}
                              />
                            ) : null}
                            <button
                              type="button"
                              className={cn(
                                "wire-asset-row wire-asset-row--subsystem",
                                subSelected && "wire-asset-row--active",
                                graphMode && !subVisible && "wire-asset-row--hidden",
                              )}
                              onClick={() => selectSubsystem(system, sub)}
                            >
                              {sub.name}
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
      {graphMode && compact ? (
        <div className="wire-asset-graph-legend" aria-label="Kategorifarver">
          {systems.map((system) => {
            const theme = getCategoryTheme(system.id);
            return (
              <span
                key={system.id}
                className="wire-asset-category-chip"
                style={{ "--wire-asset-category-color": theme.base } as CSSProperties}
              >
                <span className="wire-asset-category-chip-dot" aria-hidden />
                {theme.label}
              </span>
            );
          })}
        </div>
      ) : null}
      {detailLabel && !compact ? (
        <footer className="wire-asset-detail">
          <p className="wire-asset-detail-label">{detailLabel}</p>
          {detailCode ? (
            <p className="wire-asset-detail-meta">Kode: {detailCode}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="wire-asset-detail-action" onClick={applyAssetFilter}>
              Vis sager
            </button>
            {pathname === "/tickets" && activeId ? (
              <Link
                href="/tickets"
                className="wire-asset-detail-link"
                onClick={() => setSelection(null)}
              >
                Ryd filter
              </Link>
            ) : null}
          </div>
        </footer>
      ) : !compact ? (
        <footer className="wire-asset-detail wire-asset-detail--empty">
          <p className="text-[10px] text-[var(--gray-mid)]">Vælg et system eller undersystem</p>
        </footer>
      ) : null}
    </div>
  );
}
