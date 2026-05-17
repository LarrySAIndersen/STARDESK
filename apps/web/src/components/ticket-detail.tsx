import Link from "next/link";

import { TicketActivityPanel } from "@/components/ticket-activity-panel";
import { TicketComments } from "@/components/ticket-comments";
import { TicketAttachments } from "@/components/ticket-attachments";
import { TicketAssignmentForm } from "@/components/ticket-assignment-form";
import { TicketMetadataForm } from "@/components/ticket-metadata-form";
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
import { isStaff } from "@/lib/auth";
import type { Team } from "@/types/team";
import type { TicketDetail } from "@/types/ticket";
import type { User } from "@/types/user";

function formatDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  return new Intl.DateTimeFormat("da-DK", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function TicketDetailView({
  ticket,
  currentUser,
  teams = [],
}: {
  ticket: TicketDetail;
  currentUser: User | null;
  teams?: Team[];
}) {
  const staff = isStaff(currentUser);
  const showAttachments = (ticket.attachments?.length ?? 0) > 0;
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
          {ticket.is_major ? <Badge variant="destructive">Stor sag</Badge> : null}
          {ticket.escalation_level > 0 ? (
            <Badge variant="destructive">
              Eskalering niveau {ticket.escalation_level}
            </Badge>
          ) : null}
          {(ticket.sub_causes ?? []).map((sc) => (
            <Badge key={sc.id} variant="secondary">
              {sc.name_da}
            </Badge>
          ))}
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
              {formatDate(ticket.timestamps?.created_at ?? ticket.created_at)}
            </p>
            <p>
              <span className="text-muted-foreground">Senest opdateret:</span>{" "}
              {formatDate(ticket.timestamps?.updated_at ?? ticket.updated_at ?? null)}
            </p>
            <p>
              <span className="text-muted-foreground">Gruppe:</span>{" "}
              {ticket.assigned_team_name ?? "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Sagsbehandler:</span>{" "}
              {ticket.assigned_user_name ?? "—"}
            </p>
            {ticket.gdpr_consent ? (
              <p>
                <span className="text-muted-foreground">GDPR-samtykke:</span>{" "}
                {formatDate(ticket.gdpr_consent_at)}
              </p>
            ) : null}
            {ticket.subject_cpr ? (
              <p>
                <span className="text-muted-foreground">CPR:</span>{" "}
                <span className="font-mono">{ticket.subject_cpr}</span>
              </p>
            ) : null}
            {ticket.fault_displayed ? (
              <p>
                <span className="text-muted-foreground">Fejlviseret:</span> Ja
              </p>
            ) : null}
            {ticket.assignment_reason ? (
              <p>
                <span className="text-muted-foreground">Tildelingsårsag:</span>{" "}
                <span className="text-sm">{ticket.assignment_reason}</span>
              </p>
            ) : null}
            <TicketMetadataForm ticket={ticket} />
            {staff ? (
              <>
                <TicketStatusForm ticketId={ticket.id} currentStatus={ticket.status} />
                <TicketAssignmentForm
                  ticketId={ticket.id}
                  teams={teams}
                  currentTeamId={ticket.assigned_team_id}
                  currentUserId={ticket.assigned_user_id}
                />
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {showAttachments ? (
        <TicketAttachments
          ticketId={ticket.id}
          attachments={ticket.attachments ?? []}
          staffView={staff}
        />
      ) : null}

      {ticket.timestamps && ticket.activity ? (
        <TicketActivityPanel timestamps={ticket.timestamps} activity={ticket.activity} />
      ) : null}

      <TicketComments ticketId={ticket.id} comments={ticket.comments} staffView={staff} />
    </div>
  );
}

