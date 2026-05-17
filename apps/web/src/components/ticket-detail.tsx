import Link from "next/link";

import { CommentForm } from "@/components/comment-form";
import { TicketStatusForm } from "@/components/ticket-status-form";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { priorityLabel, statusLabel } from "@/lib/ticket-labels";
import type { TicketDetail } from "@/types/ticket";

function formatDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  return new Intl.DateTimeFormat("da-DK", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function TicketDetailView({ ticket }: { ticket: TicketDetail }) {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          ← Tilbage til oversigt
        </Link>
        <h1 className="mt-2 font-mono text-sm">{ticket.ticket_number}</h1>
        <h2 className="text-2xl font-semibold tracking-tight">{ticket.title}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="outline">{statusLabel(ticket.status)}</Badge>
          <Badge>{priorityLabel(ticket.priority)}</Badge>
          {ticket.escalation_level > 0 ? (
            <Badge variant="destructive">
              Eskalering niveau {ticket.escalation_level}
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Beskrivelse</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {ticket.description}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>SLA</CardTitle>
            <CardDescription>Frister og status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Respons:</span>{" "}
              {formatDate(ticket.response_due_at)}
            </p>
            <p>
              <span className="text-muted-foreground">Løsning:</span>{" "}
              {formatDate(ticket.resolution_due_at)}
            </p>
            <p>
              <span className="text-muted-foreground">Oprettet:</span>{" "}
              {formatDate(ticket.created_at)}
            </p>
            <TicketStatusForm ticketId={ticket.id} currentStatus={ticket.status} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Kommentarer</CardTitle>
          <CardDescription>{ticket.comments.length} kommentar(er)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {ticket.comments.length === 0 ? (
            <p className="text-muted-foreground text-sm">Ingen kommentarer endnu.</p>
          ) : (
            <ul className="space-y-4">
              {ticket.comments.map((comment) => (
                <li key={comment.id} className="border-b pb-4 last:border-0">
                  <div className="mb-1 flex items-center gap-2 text-xs">
                    <span className="font-medium">{comment.author_display_name}</span>
                    <span className="text-muted-foreground">
                      {formatDate(comment.created_at)}
                    </span>
                    {comment.is_internal ? (
                      <Badge variant="secondary">Intern</Badge>
                    ) : null}
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{comment.body}</p>
                </li>
              ))}
            </ul>
          )}
          <CommentForm ticketId={ticket.id} />
        </CardContent>
      </Card>
    </div>
  );
}

