"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { ListTree, PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";

import { AssetAddDialog } from "@/components/agent/asset-add-dialog";
import { AssetCatalogProvider, useAssetCatalog } from "@/components/agent/asset-catalog-context";
import { AssetDetailPanel } from "@/components/agent/asset-detail-panel";
import { AssetGraphNetwork } from "@/components/agent/asset-graph-network";
import { AssetTicketsPanel } from "@/components/agent/asset-tickets-panel";
import { AssetTree } from "@/components/agent/asset-tree";
import { getAssetDetail } from "@/lib/asset-details";
import { getAllAssetIds } from "@/lib/asset-graph";
import { getClientUser, isAdmin } from "@/lib/auth";
import type { User } from "@/types/user";

function AssetsPageContent({ serverUser }: { serverUser: User | null }) {
  const { systems, allEdges, metadata } = useAssetCatalog();
  const user = serverUser ?? getClientUser();
  const admin = isAdmin(user);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showTree, setShowTree] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [ticketsPanelOpen, setTicketsPanelOpen] = useState(false);
  const [visibleIds, setVisibleIds] = useState<Set<string>>(() => new Set(getAllAssetIds()));

  const allAssetIds = useMemo(() => getAllAssetIds(systems), [systems]);

  const selectedDetail = useMemo(
    () =>
      selectedId ? getAssetDetail(selectedId, systems, allEdges, metadata) : null,
    [selectedId, systems, allEdges, metadata],
  );

  const handleSelect = useCallback((assetId: string) => {
    setSelectedId(assetId);
    setTicketsPanelOpen(false);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedId(null);
    setTicketsPanelOpen(false);
  }, []);

  const handleVisibilityChange = useCallback((next: Set<string>) => {
    setVisibleIds(new Set(next));
  }, []);

  const handleAssetCreated = useCallback((assetId: string) => {
    setVisibleIds((prev) => {
      const next = new Set(prev);
      next.add(assetId);
      return next;
    });
    setSelectedId(assetId);
  }, []);

  const handleAssetDeleted = useCallback((assetId: string) => {
    setVisibleIds((prev) => {
      const next = new Set(prev);
      next.delete(assetId);
      return next;
    });
    setSelectedId(null);
    setTicketsPanelOpen(false);
  }, []);

  const allVisible = useMemo(
    () => visibleIds.size === allAssetIds.length,
    [visibleIds, allAssetIds.length],
  );

  const openAddDialog = useCallback(() => {
    if (!admin) return;
    setAddDialogOpen(true);
  }, [admin]);

  return (
    <div className="wire-scroll-content wire-assets-page flex min-h-0 flex-1 flex-col p-5">
      <p className="wire-page-lead mb-4">
        Udforsk STAR&apos;s aktiver som et verdenskort — træk bobler, administrer forbindelser
        {admin ? " (kun administrator)" : ""}, og åbn sager for det valgte aktiv.
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
        {admin ? (
          <button type="button" className="wire-asset-graph-toggle" onClick={openAddDialog}>
            <Plus className="size-3.5" aria-hidden />
            Tilføj aktiv
          </button>
        ) : null}
        <span className="text-[10px] text-[var(--gray-mid)]">
          <ListTree className="mr-1 inline size-3 align-[-2px]" aria-hidden />
          Træk bobler · træk baggrund for pan · scroll for zoom
        </span>
      </div>

      <div className="wire-assets-layout flex min-h-0 flex-1 gap-3 overflow-hidden">
        {showTree ? (
          <div className="wire-assets-card wire-assets-card--tree flex w-full max-w-[260px] shrink-0 flex-col">
            <Suspense fallback={<div className="wire-asset-panel-header">Aktiver</div>}>
              <AssetTree
                showHeader
                selectedId={selectedId}
                onSelect={handleSelect}
                compact
                visibleIds={visibleIds}
                onVisibilityChange={handleVisibilityChange}
                allVisible={allVisible}
                onAddClick={admin ? openAddDialog : undefined}
              />
            </Suspense>
          </div>
        ) : null}

        <div className="wire-assets-card wire-assets-card--graph wire-assets-graph-row flex min-h-[min(70vh,640px)] min-w-0 flex-1 overflow-hidden">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <AssetGraphNetwork
              selectedId={selectedId}
              onSelect={handleSelect}
              visibleIds={visibleIds}
              onAddClick={admin ? openAddDialog : undefined}
            />
          </div>
          <AssetDetailPanel
            assetId={selectedId}
            onClose={handleCloseDetail}
            onNavigate={handleSelect}
            onShowTickets={() => setTicketsPanelOpen((v) => !v)}
            ticketsPanelOpen={ticketsPanelOpen}
            isAdmin={admin}
            onAssetDeleted={handleAssetDeleted}
          />
          <AssetTicketsPanel
            assetId={selectedId}
            assetName={selectedDetail?.name ?? null}
            open={ticketsPanelOpen && Boolean(selectedId)}
            onClose={() => setTicketsPanelOpen(false)}
          />
        </div>
      </div>

      {admin ? (
        <AssetAddDialog
          open={addDialogOpen}
          onClose={() => setAddDialogOpen(false)}
          onCreated={handleAssetCreated}
          defaultParentSystemId={selectedId?.startsWith("sys-") ? selectedId : null}
        />
      ) : null}
    </div>
  );
}

export function AssetsPage({ serverUser }: { serverUser: User | null }) {
  return (
    <AssetCatalogProvider>
      <AssetsPageContent serverUser={serverUser} />
    </AssetCatalogProvider>
  );
}
