"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import { priorityLabel, statusLabel } from "@/lib/ticket-labels";
import type { Ticket, TicketDetail, TicketSummary } from "@/types/ticket";

const selectClassName =
  "border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

function ChildTicketsTable({ items }: { items: TicketSummary[] }) {
  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">Ingen små sager knyttet endnu.</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Sagsnr.</TableHead>
          <TableHead>Titel</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Prioritet</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((child) => (
          <TableRow key={child.id}>
            <TableCell className="font-mono text-xs">
              <Link href={`/tickets/${child.id}`} className="text-star-blue hover:underline">
                {child.ticket_number}
              </Link>
            </TableCell>
            <TableCell className="max-w-[16rem] truncate">{child.title}</TableCell>
            <TableCell>
              <Badge variant="outline">{statusLabel(child.status)}</Badge>
            </TableCell>
            <TableCell>{priorityLabel(child.priority)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ParentPicker({
  ticketId,
  currentParentId,
  storeTickets,
  onSaved,
}: {
  ticketId: string;
  currentParentId: string | null | undefined;
  storeTickets: Ticket[];
  onSaved: () => void;
}) {
  const [parentId, setParentId] = useState(currentParentId ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setIsSubmitting(true);
    setError(null);
    try {
      await apiPatch<TicketDetail>(`/api/v1/tickets/${ticketId}/parent`, {
        parent_ticket_id: parentId || null,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke gemme");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-2">
      <select
        className={selectClassName}
        value={parentId}
        onChange={(e) => setParentId(e.target.value)}
        disabled={isSubmitting}
      >
        <option value="">Ingen store sag</option>
        {storeTickets.map((store) => (
          <option key={store.id} value={store.id}>
            {store.ticket_number} — {store.title}
          </option>
        ))}
      </select>
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
      <Button type="button" size="sm" disabled={isSubmitting} onClick={handleSave}>
        {isSubmitting ? "Gemmer…" : "Gem store sag"}
      </Button>
    </div>
  );
}

function RelatedMajorLinker({
  ticketId,
  related,
  storeTickets,
  onSaved,
}: {
  ticketId: string;
  related: TicketSummary[];
  storeTickets: Ticket[];
  onSaved: () => void;
}) {
  const [relatedId, setRelatedId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = storeTickets.filter(
    (store) => store.id !== ticketId && !related.some((item) => item.id === store.id),
  );

  async function handleAdd() {
    if (!relatedId) {
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await apiPost<TicketDetail>(`/api/v1/tickets/${ticketId}/related-majors`, {
        related_ticket_id: relatedId,
      });
      setRelatedId("");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke tilføje link");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRemove(otherId: string) {
    setIsSubmitting(true);
    setError(null);
    try {
      await apiDelete(`/api/v1/tickets/${ticketId}/related-majors/${otherId}`);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke fjerne link");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      {related.length === 0 ? (
        <p className="text-muted-foreground text-sm">Ingen relaterede store sager.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {related.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2">
              <Link href={`/tickets/${item.id}`} className="text-star-blue font-mono hover:underline">
                {item.ticket_number}
              </Link>
              <span className="min-w-0 flex-1 truncate">{item.title}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSubmitting}
                onClick={() => handleRemove(item.id)}
              >
                Fjern
              </Button>
            </li>
          ))}
        </ul>
      )}
      {options.length > 0 ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <select
            className={selectClassName}
            value={relatedId}
            onChange={(e) => setRelatedId(e.target.value)}
            disabled={isSubmitting}
          >
            <option value="">Vælg store sag…</option>
            {options.map((store) => (
              <option key={store.id} value={store.id}>
                {store.ticket_number} — {store.title}
              </option>
            ))}
          </select>
          <Button type="button" size="sm" disabled={isSubmitting || !relatedId} onClick={handleAdd}>
            Tilføj link
          </Button>
        </div>
      ) : null}
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}

export function TicketHierarchySection({
  ticket,
  staffView,
}: {
  ticket: TicketDetail;
  staffView: boolean;
}) {
  const router = useRouter();
  const [storeTickets, setStoreTickets] = useState<Ticket[]>([]);

  const isStoreSag = ticket.is_major && !ticket.parent_ticket_id;
  const isChild = Boolean(ticket.parent_ticket_id);
  const showSection =
    isStoreSag ||
    isChild ||
    (ticket.children?.length ?? 0) > 0 ||
    (ticket.related_major_tickets?.length ?? 0) > 0 ||
    staffView;

  useEffect(() => {
    if (!staffView) {
      return;
    }
    let cancelled = false;
    apiGet<Ticket[]>("/api/v1/tickets?is_store=true")
      .then((data) => {
        if (!cancelled) {
          setStoreTickets(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStoreTickets([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [staffView]);

  if (!showSection) {
    return null;
  }

  const refresh = () => router.refresh();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sagshierarki</CardTitle>
        <CardDescription>Store sager, små sager og relationer</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {ticket.parent ? (
          <div>
            <p className="mb-2 text-sm font-medium">Store sag</p>
            <Link
              href={`/tickets/${ticket.parent.id}`}
              className="text-star-blue inline-flex flex-wrap items-center gap-2 hover:underline"
            >
              <span className="font-mono text-xs">{ticket.parent.ticket_number}</span>
              <span>{ticket.parent.title}</span>
              <Badge variant="destructive">Stor sag</Badge>
            </Link>
          </div>
        ) : isChild ? (
          <p className="text-muted-foreground text-sm">Overordnet store sag blev ikke fundet.</p>
        ) : null}

        {staffView && !ticket.is_major ? (
          <div>
            <p className="mb-2 text-sm font-medium">Tilknyt store sag</p>
            <ParentPicker
              ticketId={ticket.id}
              currentParentId={ticket.parent_ticket_id}
              storeTickets={storeTickets}
              onSaved={refresh}
            />
          </div>
        ) : null}

        {isStoreSag || (ticket.children?.length ?? 0) > 0 ? (
          <div>
            <p className="mb-2 text-sm font-medium">Små sager</p>
            <ChildTicketsTable items={ticket.children ?? []} />
          </div>
        ) : null}

        {isStoreSag && staffView ? (
          <div>
            <p className="mb-2 text-sm font-medium">Relaterede store sager</p>
            <RelatedMajorLinker
              ticketId={ticket.id}
              related={ticket.related_major_tickets ?? []}
              storeTickets={storeTickets}
              onSaved={refresh}
            />
          </div>
        ) : (ticket.related_major_tickets?.length ?? 0) > 0 ? (
          <div>
            <p className="mb-2 text-sm font-medium">Relaterede store sager</p>
            <ul className="space-y-1 text-sm">
              {(ticket.related_major_tickets ?? []).map((item) => (
                <li key={item.id}>
                  <Link href={`/tickets/${item.id}`} className="text-star-blue hover:underline">
                    {item.ticket_number} — {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
