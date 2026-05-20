"use client";

import Link from "next/link";
import { X } from "lucide-react";

import { useAssetCatalog } from "@/components/agent/asset-catalog-context";
import { MOCK_ASSET_EDGES } from "@/lib/asset-graph";
import { getAssetDetail, getAssetLabel } from "@/lib/asset-details";
import { cn } from "@/lib/utils";

interface AssetDetailPanelProps {
  assetId: string | null;
  onClose: () => void;
  onNavigate: (assetId: string) => void;
}

function statusClass(status: string): string {
  if (status === "I drift") return "wire-asset-status--live";
  if (status === "Planlagt") return "wire-asset-status--planned";
  return "wire-asset-status--retired";
}

export function AssetDetailPanel({ assetId, onClose, onNavigate }: AssetDetailPanelProps) {
  const { systems, extraEdges } = useAssetCatalog();
  const detail = assetId
    ? getAssetDetail(assetId, systems, [...MOCK_ASSET_EDGES, ...extraEdges])
    : null;
  const open = Boolean(detail);

  return (
    <aside
      className={cn("wire-asset-detail-panel", open && "wire-asset-detail-panel--open")}
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
                <dd>{detail.description}</dd>
              </div>
              {detail.relatedAssetIds.length > 0 ? (
                <div className="wire-asset-attr wire-asset-attr--block">
                  <dt>Relaterede aktiver</dt>
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
              <Link
                href={`/tickets?asset_id=${encodeURIComponent(detail.id)}`}
                className="wire-asset-detail-action"
              >
                Vis sager
              </Link>
            </footer>
          </div>
        </>
      ) : null}
    </aside>
  );
}
