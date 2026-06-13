"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Bell, X } from "lucide-react";

import { fireAndForget } from "@/lib/fire-and-forget";
import { apiGet } from "@/lib/api";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "stardesk:ticket-watch-seen-at";
const POLL_MS = 60_000;

export type TicketWatchActivity = {
  ticket_id: string;
  ticket_number: string;
  title: string;
  event_type: string;
  summary_da: string;
  created_at: string;
};

function readSeenAt(): string {
  if (typeof window === "undefined") {
    return new Date(0).toISOString();
  }
  return localStorage.getItem(STORAGE_KEY) ?? new Date(0).toISOString();
}

function writeSeenAt(iso: string) {
  localStorage.setItem(STORAGE_KEY, iso);
}

export function TicketWatchUpdatesBanner({ className }: { className?: string }) {
  const [items, setItems] = useState<TicketWatchActivity[]>([]);
  const [dismissed, setDismissed] = useState(false);

  const load = useCallback(async () => {
    try {
      const since = encodeURIComponent(readSeenAt());
      const rows = await apiGet<TicketWatchActivity[]>(
        `/api/v1/personal/ticket-watch/updates?since=${since}`,
      );
      setItems(rows);
      if (rows.length > 0) {
        setDismissed(false);
      }
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    fireAndForget(load());
    const id = window.setInterval(() => fireAndForget(load()), POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  if (dismissed || items.length === 0) {
    return null;
  }

  const markSeen = () => {
    writeSeenAt(new Date().toISOString());
    setDismissed(true);
    setItems([]);
  };

  return (
    <div
      className={cn(
        "border-star-blue/30 bg-star-blue-light/40 mb-3 rounded-sm border px-3 py-2.5",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="text-star-navy flex items-center gap-1.5 text-sm font-semibold">
          <Bell className="size-4 shrink-0" aria-hidden />
          Opdateringer på overvågede sager
        </p>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground rounded p-0.5"
          aria-label="Markér som læst"
          onClick={markSeen}
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <ul className="space-y-1.5">
        {items.slice(0, 5).map((item) => (
          <li key={`${item.ticket_id}-${item.created_at}`} className="text-sm">
            <Link
              href={`/tickets/${item.ticket_id}`}
              className="text-star-blue hover:text-star-navy font-medium underline-offset-2 hover:underline"
            >
              {item.ticket_number}
            </Link>
            <span className="text-muted-foreground"> · {item.summary_da}</span>
            <span className="text-muted-foreground block truncate text-xs">{item.title}</span>
          </li>
        ))}
      </ul>
      {items.length > 5 ? (
        <p className="text-muted-foreground mt-1 text-xs">+ {items.length - 5} flere opdateringer</p>
      ) : null}
    </div>
  );
}
