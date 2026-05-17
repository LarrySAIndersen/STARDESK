import Link from "next/link";

import { Badge } from "@/components/ui/badge";
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
import { apiGet } from "@/lib/api";
import { priorityLabel, statusLabel } from "@/lib/ticket-labels";
import type { Ticket } from "@/types/ticket";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("da-DK", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

function priorityVariant(
  priority: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (priority === "critical" || priority === "high") {
    return "destructive";
  }
  if (priority === "medium") {
    return "default";
  }
  return "secondary";
}

export async function TicketList() {
  let tickets: Ticket[] = [];
  let fetchError: string | null = null;

  try {
    tickets = await apiGet<Ticket[]>("/api/v1/tickets");
  } catch {
    fetchError = "Kunne ikke hente sager fra API. Tjek at backend kører.";
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sager</CardTitle>
        <CardDescription>
          {fetchError
            ? "Forbindelse til API mislykkedes"
            : `${tickets.length} sag${tickets.length === 1 ? "" : "er"}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {fetchError ? (
          <p className="text-destructive text-sm">{fetchError}</p>
        ) : tickets.length === 0 ? (
          <p className="text-muted-foreground text-sm">Ingen sager endnu</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sagsnr.</TableHead>
                <TableHead>Titel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Prioritet</TableHead>
                <TableHead>Oprettet</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((ticket) => (
                <TableRow key={ticket.id}>
                  <TableCell className="font-mono text-xs">
                    <Link
                      href={`/tickets/${ticket.id}`}
                      className="hover:underline"
                    >
                      {ticket.ticket_number}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    <Link
                      href={`/tickets/${ticket.id}`}
                      className="hover:underline"
                    >
                      {ticket.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{statusLabel(ticket.status)}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={priorityVariant(ticket.priority)}>
                      {priorityLabel(ticket.priority)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {formatDate(ticket.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

