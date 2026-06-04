"use client";

import { fireAndForget } from "@/lib/fire-and-forget";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Ticket, X } from "lucide-react";

import { useAssetCatalog } from "@/components/agent/asset-catalog-context";
import { WirePriorityBadge, WireStatusBadge } from "@/components/wireframe/wire-badge";
import { apiGet } from "@/lib/api";
import { filterTicketsForAsset } from "@/lib/asset-tickets";
import { cn } from "@/lib/utils";
import type { Ticket as TicketType } from "@/types/ticket";

interface AssetTicketsPanelProps {
  assetId: string | null;
  assetName: string | null;
  open: boolean;
  onClose: () => void;
}

export function AssetTicketsPanel({
  assetId,
  assetName,
  open,
  onClose,
}: AssetTicketsPanelProps) {
  const { systems } = useAssetCatalog();
  const [tickets, setTickets] = useState<TicketType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !assetId) {
      setTickets([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fireAndForget(
      apiGet<TicketType[]>("/api/v1/tickets?board=true&limit=500")
        .then((rows) => {
          if (cancelled) return;
          setTickets(filterTicketsForAsset(rows, assetId, systems));
        })
        .catch((err) => {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : "Kunne ikke hente sager");
          setTickets([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        }),
    );
    return () => {
      cancelled = true;
    };
  }, [open, assetId, systems]);

  return (
    <aside
      className={cn("wire-asset-tickets-panel", open && "wire-asset-tickets-panel--open")}
      aria-hidden={!open}
      aria-label={assetName ? `Sager for ${assetName}` : undefined}
    >
      {open && assetId ? (
        <>
          <header className="wire-asset-tickets-panel-header">
            <div className="min-w-0 flex-1">
              <p className="wire-asset-detail-panel-kicker flex items-center gap-1">
                <Ticket className="size-3" aria-hidden />
                Sager
              </p>
              <h2 className="wire-asset-detail-panel-title truncate">{assetName ?? assetId}</h2>
            </div>
            <button
              type="button"
              className="wire-asset-detail-panel-close"
              onClick={onClose}
              aria-label="Luk sagsliste"
            >
              <X className="size-4" aria-hidden />
            </button>
          </header>

          <div className="wire-asset-tickets-panel-body">
            {loading ? (
              <p className="text-muted-foreground text-xs">Henter sager…</p>
            ) : error ? (
              <p className="text-star-red text-xs" role="alert">
                {error}
              </p>
            ) : tickets.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                Ingen sager matcher dette aktiv (søger i tags, titel og beskrivelse).
              </p>
            ) : (
              <ul className="wire-asset-tickets-list">
                {tickets.map((ticket) => (
                  <li key={ticket.id}>
                    <Link
                      href={`/tickets/${ticket.id}`}
                      className="wire-asset-ticket-link"
                    >
                      <span className="font-mono text-[10px] text-[var(--gray-mid)]">
                        {ticket.ticket_number}
                      </span>
                      <span className="line-clamp-2 text-[12px] font-semibold text-[var(--star-text)]">
                        {ticket.title}
                      </span>
                      <span className="mt-1 flex flex-wrap gap-1">
                        <WireStatusBadge status={ticket.status} />
                        <WirePriorityBadge priority={ticket.priority} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <footer className="wire-asset-tickets-panel-footer">
            <Link
              href={`/tickets?asset_id=${encodeURIComponent(assetId)}`}
              className="wire-asset-detail-action block text-center text-[11px]"
            >
              Åbn i sagsoversigt
            </Link>
          </footer>
        </>
      ) : null}
    </aside>
  );
}
