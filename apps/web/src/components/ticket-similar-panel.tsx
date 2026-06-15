"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { fetchSimilarTickets, type SimilarTicket } from "@/lib/tag-catalog";

export function TicketSimilarPanel({ ticketId }: { ticketId: string }) {
  const [items, setItems] = useState<SimilarTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [closedOnly, setClosedOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchSimilarTickets(ticketId, { closedOnly, limit: 5 })
      .then((result) => {
        if (!cancelled) {
          setItems(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Kunne ikke hente lignende sager");
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
  }, [ticketId, closedOnly]);

  return (
    <Card className="border-star-blue/20 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Lignende sager</CardTitle>
        <CardDescription>
          Match på tags, emner og tekst — klar til AI-udvidelse
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <label className="text-muted-foreground flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={closedOnly}
            onChange={(event) => setClosedOnly(event.target.checked)}
          />
          Vis kun lukkede/løste sager
        </label>

        {loading ? (
          <p className="text-muted-foreground text-xs">Henter forslag…</p>
        ) : null}
        {error ? <p className="text-destructive text-xs">{error}</p> : null}
        {!loading && !error && items.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            Ingen lignende sager fundet endnu.
          </p>
        ) : null}

        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-[2px] border border-[var(--gray-border)] p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  href={`/tickets/${item.id}`}
                  className="text-star-navy font-medium hover:underline"
                >
                  {item.ticket_number} — {item.title}
                </Link>
                <Badge variant="secondary">
                  {Math.round(item.score * 100)}% match
                </Badge>
              </div>
              <p className="text-muted-foreground mt-1 text-xs">
                {item.match_reasons.join(" · ")}
              </p>
              {item.tags.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {item.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-[10px]">
                      {tag}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
