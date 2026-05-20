"use client";

import { useMemo, useState } from "react";
import { Link2, Pencil, Ticket, Trash2, X } from "lucide-react";

import { AssetEditDialog } from "@/components/agent/asset-edit-dialog";
import { useAssetCatalog } from "@/components/agent/asset-catalog-context";
import { getAssetDetail, getAssetLabel } from "@/lib/asset-details";
import { cn } from "@/lib/utils";
import type { AssetGraphEdge } from "@/types/asset";

interface AssetDetailPanelProps {
  assetId: string | null;
  onClose: () => void;
  onNavigate: (assetId: string) => void;
  onShowTickets: () => void;
  ticketsPanelOpen: boolean;
  isAdmin: boolean;
  onAssetDeleted?: (assetId: string) => void;
}

function statusClass(status: string): string {
  if (status === "I drift") return "wire-asset-status--live";
  if (status === "Planlagt") return "wire-asset-status--planned";
  return "wire-asset-status--retired";
}

export function AssetDetailPanel({
  assetId,
  onClose,
  onNavigate,
  onShowTickets,
  ticketsPanelOpen,
  isAdmin,
  onAssetDeleted,
}: AssetDetailPanelProps) {
  const { systems, allEdges, metadata, addConnection, removeConnection } = useAssetCatalog();
  const [editOpen, setEditOpen] = useState(false);
  const [connectTarget, setConnectTarget] = useState("");

  const detail = useMemo(
    () => (assetId ? getAssetDetail(assetId, systems, allEdges, metadata) : null),
    [assetId, systems, allEdges, metadata],
  );

  const open = Boolean(detail);

  const connectionRows = useMemo(() => {
    if (!detail) return [];
    return detail.connectionEdgeIds
      .map((edgeId) => {
        const edge = allEdges.find((e) => e.id === edgeId);
        if (!edge) return null;
        const otherId = edge.source === detail.id ? edge.target : edge.source;
        return { edgeId, edge, otherId, label: getAssetLabel(otherId, systems) };
      })
      .filter(Boolean) as {
      edgeId: string;
      edge: AssetGraphEdge;
      otherId: string;
      label: string;
    }[];
  }, [detail, allEdges, systems]);

  const connectOptions = useMemo(() => {
    if (!detail) return [];
    const ids: { id: string; label: string }[] = [];
    for (const system of systems) {
      if (system.id !== detail.id) {
        ids.push({ id: system.id, label: system.name });
      }
      for (const sub of system.subsystems) {
        if (sub.id !== detail.id) {
          ids.push({ id: sub.id, label: `${system.name} › ${sub.name}` });
        }
      }
    }
    return ids.sort((a, b) => a.label.localeCompare(b.label, "da"));
  }, [detail, systems]);

  const handleAddConnection = () => {
    if (!detail || !connectTarget) return;
    addConnection(detail.id, connectTarget);
    setConnectTarget("");
  };

  return (
    <>
      <aside
        className={cn(
          "wire-asset-detail-panel",
          open && "wire-asset-detail-panel--open",
          ticketsPanelOpen && "wire-asset-detail-panel--with-tickets",
        )}
        aria-hidden={!open}
        aria-label={detail ? `Detaljer for ${detail.name}` : undefined}
      >
        {detail ? (
          <>
            <header className="wire-asset-detail-panel-header">
              <div className="min-w-0 flex-1">
                <p className="wire-asset-detail-panel-kicker">
                  {detail.kind === "system" ? "System" : "Undersystem"}
                </p>
                <h2 className="wire-asset-detail-panel-title">{detail.name}</h2>
              </div>
              <button
                type="button"
                className="wire-asset-detail-panel-close"
                onClick={onClose}
                aria-label="Luk detaljer"
              >
                <X className="size-4" aria-hidden />
              </button>
            </header>

            <div className="wire-asset-detail-panel-body">
              {isAdmin ? (
                <div className="mb-3 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    className="wire-asset-graph-toggle"
                    onClick={() => setEditOpen(true)}
                  >
                    <Pencil className="size-3" aria-hidden />
                    Rediger
                  </button>
                </div>
              ) : null}

              <dl className="wire-asset-attr-list">
                <div className="wire-asset-attr">
                  <dt>Navn</dt>
                  <dd>{detail.name}</dd>
                </div>
                <div className="wire-asset-attr">
                  <dt>ID / kode</dt>
                  <dd>
                    <span className="font-mono text-[10px]">{detail.id}</span>
                    <span className="text-[var(--gray-mid)]"> · {detail.code}</span>
                  </dd>
                </div>
                <div className="wire-asset-attr">
                  <dt>Type</dt>
                  <dd>{detail.kind === "system" ? "System" : "Undersystem"}</dd>
                </div>
                <div className="wire-asset-attr">
                  <dt>Status</dt>
                  <dd>
                    <span className={cn("wire-asset-status", statusClass(detail.status))}>
                      {detail.status}
                    </span>
                  </dd>
                </div>
                <div className="wire-asset-attr">
                  <dt>Ejer / team</dt>
                  <dd>{detail.ownerTeam}</dd>
                </div>
                <div className="wire-asset-attr">
                  <dt>Miljø</dt>
                  <dd>{detail.environment}</dd>
                </div>
                {detail.parentSystemName ? (
                  <div className="wire-asset-attr">
                    <dt>Overordnet system</dt>
                    <dd>
                      <button
                        type="button"
                        className="wire-asset-related-link"
                        onClick={() =>
                          detail.parentSystemId && onNavigate(detail.parentSystemId)
                        }
                      >
                        {detail.parentSystemName}
                      </button>
                    </dd>
                  </div>
                ) : null}
                <div className="wire-asset-attr wire-asset-attr--block">
                  <dt>Beskrivelse</dt>
                  <dd>{detail.description || "—"}</dd>
                </div>

                <div className="wire-asset-attr wire-asset-attr--block">
                  <dt className="flex items-center gap-1">
                    <Link2 className="size-3" aria-hidden />
                    Forbindelser
                  </dt>
                  <dd>
                    {connectionRows.length === 0 ? (
                      <p className="text-[var(--gray-mid)] text-[11px]">Ingen forbindelser</p>
                    ) : (
                      <ul className="wire-asset-related-list">
                        {connectionRows.map((row) => (
                          <li
                            key={row.edgeId}
                            className="flex items-center justify-between gap-2"
                          >
                            <button
                              type="button"
                              className="wire-asset-related-link min-w-0 truncate"
                              onClick={() => onNavigate(row.otherId)}
                            >
                              {row.label}
                            </button>
                            {isAdmin ? (
                              <button
                                type="button"
                                className="text-star-red shrink-0 p-0.5 hover:opacity-80"
                                aria-label={`Slet forbindelse til ${row.label}`}
                                onClick={() => removeConnection(row.edgeId)}
                              >
                                <Trash2 className="size-3.5" aria-hidden />
                              </button>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                    {isAdmin ? (
                      <div className="mt-2 flex flex-col gap-1.5">
                        <select
                          className="border-input bg-background w-full rounded-sm border border-[var(--gray-border)] px-2 py-1.5 text-[11px]"
                          value={connectTarget}
                          onChange={(e) => setConnectTarget(e.target.value)}
                          aria-label="Vælg aktiv at forbinde til"
                        >
                          <option value="">Tilføj forbindelse til…</option>
                          {connectOptions.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="wire-asset-graph-toggle self-start"
                          disabled={!connectTarget}
                          onClick={handleAddConnection}
                        >
                          Opret forbindelse
                        </button>
                      </div>
                    ) : null}
                  </dd>
                </div>

                {detail.relatedAssetIds.length > 0 ? (
                  <div className="wire-asset-attr wire-asset-attr--block">
                    <dt>Naboer på kortet</dt>
                    <dd>
                      <ul className="wire-asset-related-list">
                        {detail.relatedAssetIds.map((relatedId) => (
                          <li key={relatedId}>
                            <button
                              type="button"
                              className="wire-asset-related-link"
                              onClick={() => onNavigate(relatedId)}
                            >
                              {getAssetLabel(relatedId, systems)}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                ) : null}
                <div className="wire-asset-attr">
                  <dt>Sidst opdateret</dt>
                  <dd>{detail.lastUpdated}</dd>
                </div>
              </dl>

              <footer className="wire-asset-detail-panel-footer">
                <button
                  type="button"
                  className="wire-asset-detail-action w-full"
                  onClick={onShowTickets}
                >
                  <Ticket className="mr-1.5 inline size-3.5 align-[-2px]" aria-hidden />
                  {ticketsPanelOpen ? "Skjul sager" : "Vis sager"}
                </button>
              </footer>
            </div>
          </>
        ) : null}
      </aside>

      <AssetEditDialog
        open={editOpen}
        detail={detail}
        onClose={() => setEditOpen(false)}
        onSaved={() => setEditOpen(false)}
        onDeleted={(id) => {
          setEditOpen(false);
          onAssetDeleted?.(id);
        }}
      />
    </>
  );
}
