import Link from "next/link";
import type { ReactNode } from "react";

import { CommentForm } from "@/components/comment-form";
import { TicketActivityPanel } from "@/components/ticket-activity-panel";
import { TicketAttachments } from "@/components/ticket-attachments";
import { TicketAssignmentForm } from "@/components/ticket-assignment-form";
import { TicketDetailActions } from "@/components/ticket-detail-actions";
import { TicketHierarchySection } from "@/components/ticket-hierarchy-section";
import { TicketIntelligencePanel } from "@/components/ticket-intelligence-panel";
import { TicketMetadataForm } from "@/components/ticket-metadata-form";
import { TicketStatusForm } from "@/components/ticket-status-form";
import { TicketComments } from "@/components/ticket-comments";
import { TicketTagBadges } from "@/components/ticket-tag-badges";
import { Badge } from "@/components/ui/badge";
import { ResizableSplit } from "@/components/ui/resizable-split";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { priorityLabel, statusLabel, ticketTypeLabel } from "@/lib/ticket-labels";
import { isStaff } from "@/lib/auth";
import type { Team } from "@/types/team";
import type { TicketDetail } from "@/types/ticket";
import type { User } from "@/types/user";

function formatDate(iso: string | null | undefined): string {
  if (!iso) {
    return "—";
  }
  return new Intl.DateTimeFormat("da-DK", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="ledger-label text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  );
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
  const visibleComments = staff
    ? ticket.comments
    : ticket.comments.filter((c) => !c.is_internal);

  return (
    <article className="space-y-6">
      <header className="ledger-card border-star-navy/10 bg-white p-6">
        <Link
          href="/"
          className="text-muted-foreground hover:text-star-navy text-sm transition-colors"
        >
          ← Tilbage til oversigt
        </Link>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-star-navy font-mono text-sm font-semibold">
            {ticket.ticket_number}
          </span>
          <span className="ledger-status-pill">
            <span className="bg-star-navy size-2 shrink-0 rounded-full" aria-hidden />
            {statusLabel(ticket.status)}
          </span>
          {ticket.is_major ? <Badge variant="destructive">Stor sag</Badge> : null}
          {ticket.is_security_ticket ? (
            <Badge variant="outline" className="border-amber-600 text-amber-800">
              Sikkerhedssag
            </Badge>
          ) : null}
        </div>
        <h1 className="text-star-navy mt-4 flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          {ticket.emoji ? (
            <span className="text-3xl leading-none" aria-hidden>
              {ticket.emoji}
            </span>
          ) : null}
          {ticket.title}
        </h1>
        {(ticket.tags?.length ?? 0) > 0 ? (
          <div className="mt-3">
            <TicketTagBadges tags={ticket.tags} emoji={null} maxTags={10} />
          </div>
        ) : null}
        {staff ? (
          <div className="mt-5">
            <TicketDetailActions ticketId={ticket.id} currentStatus={ticket.status} />
          </div>
        ) : null}
      </header>

      <ResizableSplit
        storageKey="stardesk-ticket-detail"
        defaultSizes={[62, 38]}
        minSizes={[40, 28]}
        className="min-h-[24rem] items-start"
      >
        <div className="space-y-6 overflow-auto pr-2">
          <Card className="ledger-card shadow-sm">
            <CardHeader className="border-b pb-4">
              <CardTitle className="ledger-label text-star-navy font-semibold">
                Beskrivelse
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">
                {ticket.description}
              </p>
            </CardContent>
          </Card>

          {showAttachments ? (
            <TicketAttachments
              ticketId={ticket.id}
              attachments={ticket.attachments ?? []}
              staffView={staff}
            />
          ) : null}

          <Card className="ledger-card shadow-sm">
            <CardHeader className="border-b pb-4">
              <CardTitle className="text-star-navy font-semibold">Indmelder</CardTitle>
              <CardDescription>Kontakt og sagsdetaljer</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <p className="text-star-navy text-lg font-semibold">
                {ticket.reporter_display_name ?? "Ukendt"}
              </p>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                <DetailField label="Kategori" value={ticket.category_name_da ?? "—"} />
                <DetailField label="Underkategori" value={ticket.subcategory_name_da ?? "—"} />
                <DetailField label="Prioritet" value={priorityLabel(ticket.priority)} />
                <DetailField label="Type" value={ticketTypeLabel(ticket.ticket_type)} />
                <DetailField
                  label="Påvirkning"
                  value={
                    ticket.escalation_level > 0
                      ? `Eskalering niveau ${ticket.escalation_level}`
                      : priorityLabel(ticket.priority)
                  }
                />
                <DetailField
                  label="Aktiv / system"
                  value={
                    (ticket.sub_causes ?? []).length > 0
                      ? ticket.sub_causes.map((sc) => sc.name_da).join(", ")
                      : "—"
                  }
                />
                <DetailField label="Tildelt gruppe" value={ticket.assigned_team_name ?? "—"} />
                <DetailField label="Sagsbehandler" value={ticket.assigned_user_name ?? "—"} />
                <DetailField
                  label="Responsfrist"
                  value={formatDate(ticket.response_due_at)}
                />
                <DetailField
                  label="Løsningsfrist"
                  value={formatDate(ticket.resolution_due_at)}
                />
              </dl>
            </CardContent>
          </Card>

          <TicketHierarchySection ticket={ticket} staffView={staff} />

          {staff && ticket.intelligence ? (
            <TicketIntelligencePanel ticketId={ticket.id} intelligence={ticket.intelligence} />
          ) : null}

          {staff ? (
            <Card id="ticket-assign" className="ledger-card scroll-mt-6 shadow-sm">
              <CardHeader>
                <CardTitle className="text-star-navy">Tildeling og status</CardTitle>
                <CardDescription>Opdater gruppe, sagsbehandler og status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <TicketMetadataForm ticket={ticket} staff={staff} />
                <TicketStatusForm ticketId={ticket.id} currentStatus={ticket.status} />
                <TicketAssignmentForm
                  ticketId={ticket.id}
                  teams={teams}
                  currentTeamId={ticket.assigned_team_id}
                  currentUserId={ticket.assigned_user_id}
                />
              </CardContent>
            </Card>
          ) : null}
        </div>

        <aside className="space-y-6 overflow-auto pl-2">
          {ticket.timestamps && ticket.activity ? (
            <TicketActivityPanel timestamps={ticket.timestamps} activity={ticket.activity} />
          ) : null}

          <Card className="ledger-card shadow-sm">
            <CardHeader className="border-b pb-4">
              <CardTitle className="text-star-navy font-semibold">Kommentarer</CardTitle>
              <CardDescription>
                {visibleComments.length === 0
                  ? "Ingen kommentarer endnu."
                  : `${visibleComments.length} i tidslinjen`}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <TicketComments
                ticketId={ticket.id}
                comments={ticket.comments}
                staffView={staff}
                embedded
              />
              <div className="border-star-navy/10 mt-4 border-t pt-4">
                <p className="ledger-label text-muted-foreground mb-3 text-xs">Ny kommentar</p>
                <CommentForm ticketId={ticket.id} staffMode={staff} primaryNavy />
              </div>
            </CardContent>
          </Card>
        </aside>
      </ResizableSplit>
    </article>
  );
}
