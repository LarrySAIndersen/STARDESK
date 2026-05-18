"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight, Layers } from "lucide-react";

import { MOCK_ASSET_SYSTEMS } from "@/lib/mock-assets";
import { cn } from "@/lib/utils";
import type { AssetSelection, AssetSubsystem, AssetSystem } from "@/types/asset";

function selectionKey(selection: AssetSelection | null): string | null {
  if (!selection) return null;
  return selection.kind === "system"
    ? selection.system.id
    : selection.subsystem.id;
}

export function AgentAssetPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const assetFromUrl = searchParams.get("asset_id");

  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const system of MOCK_ASSET_SYSTEMS) {
      initial[system.id] = true;
    }
    return initial;
  });

  const [selection, setSelection] = useState<AssetSelection | null>(() => {
    if (!assetFromUrl) return null;
    return resolveSelection(assetFromUrl);
  });

  const activeId = useMemo(
    () => selectionKey(selection) ?? assetFromUrl,
    [selection, assetFromUrl],
  );

  const toggleExpanded = useCallback((systemId: string) => {
    setExpanded((prev) => ({ ...prev, [systemId]: !prev[systemId] }));
  }, []);

  const selectSystem = useCallback((system: AssetSystem) => {
    setSelection({ kind: "system", system });
  }, []);

  const selectSubsystem = useCallback((system: AssetSystem, subsystem: AssetSubsystem) => {
    setSelection({ kind: "subsystem", system, subsystem });
  }, []);

  const applyAssetFilter = useCallback(() => {
    const id = selectionKey(selection);
    if (!id) return;
    const params = new URLSearchParams();
    params.set("asset_id", id);
    router.push(`/tickets?${params.toString()}`);
  }, [router, selection]);

  const detailLabel =
    selection?.kind === "subsystem"
      ? `${selection.system.name} › ${selection.subsystem.name}`
      : selection?.kind === "system"
        ? selection.system.name
        : null;

  const detailCode =
    selection?.kind === "subsystem"
      ? selection.subsystem.code
      : selection?.kind === "system"
        ? selection.system.code
        : null;

  return (
    <aside className="wire-asset-panel" aria-label="Aktiver">
      <div className="wire-asset-panel-header">
        <Layers className="size-3.5 shrink-0 opacity-70" aria-hidden />
        <span>Aktiver</span>
      </div>
      <div className="wire-asset-tree min-h-0 flex-1 overflow-y-auto">
        <ul className="m-0 list-none p-0" role="tree">
          {MOCK_ASSET_SYSTEMS.map((system) => {
            const isOpen = expanded[system.id] ?? false;
            const systemSelected =
              activeId === system.id ||
              (selection?.kind === "system" && selection.system.id === system.id);

            return (
              <li
                key={system.id}
                role="treeitem"
                aria-expanded={isOpen}
                aria-selected={systemSelected}
              >
                <div className="flex min-w-0 items-stretch">
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
                  <button
                    type="button"
                    className={cn(
                      "wire-asset-row wire-asset-row--system",
                      systemSelected && "wire-asset-row--active",
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
                      return (
                        <li key={sub.id} role="treeitem" aria-selected={subSelected}>
                          <button
                            type="button"
                            className={cn(
                              "wire-asset-row wire-asset-row--subsystem",
                              subSelected && "wire-asset-row--active",
                            )}
                            onClick={() => selectSubsystem(system, sub)}
                          >
                            {sub.name}
                          </button>
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

      {detailLabel ? (
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
      ) : (
        <footer className="wire-asset-detail wire-asset-detail--empty">
          <p className="text-[10px] text-[var(--gray-mid)]">Vælg et system eller undersystem</p>
        </footer>
      )}
    </aside>
  );
}

function resolveSelection(assetId: string): AssetSelection | null {
  for (const system of MOCK_ASSET_SYSTEMS) {
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
