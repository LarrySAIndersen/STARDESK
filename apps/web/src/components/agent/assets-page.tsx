"use client";

import { Suspense, useCallback, useState } from "react";
import { ListTree, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { AssetDetailPanel } from "@/components/agent/asset-detail-panel";
import { AssetGraphNetwork } from "@/components/agent/asset-graph-network";
import { AssetTree } from "@/components/agent/asset-tree";
import { cn } from "@/lib/utils";

export function AssetsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showTree, setShowTree] = useState(true);

  const handleSelect = useCallback((assetId: string) => {
    setSelectedId(assetId);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedId(null);
  }, []);

  return (
    <div className="wire-scroll-content flex min-h-0 flex-1 flex-col p-5">
      <p className="wire-page-lead mb-4">
        Udforsk STAR&apos;s aktiver som et verdenskort — klik på bobler for at se CMDB-detaljer
        og forbindelser. Data er midlertidigt statisk, indtil aktiver er gemt i databasen.
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="wire-asset-graph-toggle"
          onClick={() => setShowTree((v) => !v)}
          aria-pressed={showTree}
        >
          {showTree ? (
            <PanelLeftClose className="size-3.5" aria-hidden />
          ) : (
            <PanelLeftOpen className="size-3.5" aria-hidden />
          )}
          {showTree ? "Skjul liste" : "Vis liste"}
        </button>
        <span className="text-[10px] text-[var(--gray-mid)]">
          <ListTree className="mr-1 inline size-3 align-[-2px]" aria-hidden />
          Træk i kortet · scroll for zoom
        </span>
      </div>

      <div className="wire-assets-layout flex min-h-0 flex-1 gap-0 overflow-hidden">
        {showTree ? (
          <div className="wire-assets-card wire-assets-card--tree flex w-full max-w-[220px] shrink-0 flex-col">
            <Suspense fallback={<div className="wire-asset-panel-header">Aktiver</div>}>
              <AssetTree
                showHeader
                selectedId={selectedId}
                onSelect={handleSelect}
                compact
              />
            </Suspense>
          </div>
        ) : null}

        <div
          className={cn(
            "wire-assets-card wire-assets-card--graph relative flex min-h-[420px] min-w-0 flex-1 flex-col overflow-hidden",
          )}
        >
          <AssetGraphNetwork selectedId={selectedId} onSelect={handleSelect} />
          <AssetDetailPanel
            assetId={selectedId}
            onClose={handleCloseDetail}
            onNavigate={handleSelect}
          />
        </div>
      </div>
    </div>
  );
}
