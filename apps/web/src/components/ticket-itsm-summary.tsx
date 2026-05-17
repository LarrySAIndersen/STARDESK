import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { priorityLabel, statusLabel, ticketTypeLabel } from "@/lib/ticket-labels";
import type { TicketDetail } from "@/types/ticket";

function formatDate(iso: string | null | undefined): string {
  if (!iso) {
    return "—";
  }
  return new Intl.DateTimeFormat("da-DK", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function TicketItsmSummary({ ticket }: { ticket: TicketDetail }) {
  return (
    <Card className="border-star-blue/20">
      <CardHeader>
        <CardTitle>Sagsoplysninger (ITSM)</CardTitle>
        <CardDescription>Grunddata til behandling af sagen</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-muted-foreground text-xs uppercase">Sagsnr.</dt>
            <dd className="font-mono font-medium">{ticket.ticket_number}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs uppercase">Type</dt>
            <dd>{ticketTypeLabel(ticket.ticket_type)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs uppercase">Status</dt>
            <dd>
              <Badge variant="outline">{statusLabel(ticket.status)}</Badge>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs uppercase">Prioritet</dt>
            <dd>
              <Badge>{priorityLabel(ticket.priority)}</Badge>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs uppercase">Kategori</dt>
            <dd>{ticket.category_name_da ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs uppercase">Underkategori</dt>
            <dd>{ticket.subcategory_name_da ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs uppercase">Indmelder</dt>
            <dd>{ticket.reporter_display_name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs uppercase">Tildelt gruppe</dt>
            <dd>{ticket.assigned_team_name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs uppercase">Sagsbehandler</dt>
            <dd>{ticket.assigned_user_name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs uppercase">Responsfrist</dt>
            <dd>{formatDate(ticket.response_due_at)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs uppercase">Løsningsfrist</dt>
            <dd>{formatDate(ticket.resolution_due_at)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs uppercase">Oprettet</dt>
            <dd>{formatDate(ticket.timestamps?.created_at ?? ticket.created_at)}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
