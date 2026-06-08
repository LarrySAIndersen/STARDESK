"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { TicketDetailView } from "@/components/ticket-detail";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/api";
import type { Category } from "@/types/category";
import type { Team } from "@/types/team";
import type { TicketDetail } from "@/types/ticket";
import type { User } from "@/types/user";

export function KanbanTicketDrawer({
  ticketId,
  teams,
  categories,
  currentUser,
  onClose,
}: {
  ticketId: string | null;
  teams: Team[];
  categories: Category[];
  currentUser: User | null;
  onClose: () => void;
}) {
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ticketId) {
      setTicket(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiGet<TicketDetail>(`/api/v1/tickets/${ticketId}`)
      .then((data) => {
        if (!cancelled) {
          setTicket(data);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Kunne ikke hente sagen.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [ticketId]);

  if (!ticketId) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/30"
        aria-label="Luk sag"
        onClick={onClose}
      />
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col border-l border-[var(--gray-border)] bg-background shadow-xl"
        role="dialog"
        aria-label="Sag i pop-out"
      >
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--gray-border)] px-4 py-3">
          <p className="text-sm font-semibold">Sag (pop-out)</p>
          <div className="flex items-center gap-2">
            <Link
              href={`/tickets/${ticketId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-muted"
            >
              Åbn fuld sag
            </Link>
            <Button variant="ghost" size="sm" type="button" onClick={onClose}>
              Luk
            </Button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-muted-foreground p-6 text-sm">Henter sag…</p>
          ) : error ? (
            <p className="text-destructive p-6 text-sm">{error}</p>
          ) : ticket ? (
            <TicketDetailView
              ticket={ticket}
              currentUser={currentUser}
              teams={teams}
              categories={categories}
              onTicketUpdated={setTicket}
            />
          ) : null}
        </div>
      </aside>
    </>
  );
}
