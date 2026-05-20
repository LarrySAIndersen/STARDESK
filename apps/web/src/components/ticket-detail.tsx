import Link from "next/link";

import type { ReactNode } from "react";



import { CommentForm } from "@/components/comment-form";

import { TicketActivityPanel } from "@/components/ticket-activity-panel";

import { TicketAttachments } from "@/components/ticket-attachments";

import { TicketAssignmentForm } from "@/components/ticket-assignment-form";

import { KnowledgeArticlePromoteButton } from "@/components/knowledge-article-promote-button";
import { TicketDetailActions } from "@/components/ticket-detail-actions";
import { TicketSlackPush } from "@/components/ticket-slack-push";

import { TicketHierarchySection } from "@/components/ticket-hierarchy-section";
import { TicketDetailTopBand } from "@/components/ticket/ticket-detail-top-band";

import { RoutingReadinessBanner } from "@/components/routing-readiness-banner";
import { TicketIntelligencePanel } from "@/components/ticket-intelligence-panel";
import { TicketPriorityForm } from "@/components/ticket-priority-form";

import { TicketMetadataForm } from "@/components/ticket-metadata-form";

import { TicketStatusForm } from "@/components/ticket-status-form";

import { TicketComments } from "@/components/ticket-comments";
import { TicketEmailThread } from "@/components/ticket-email-thread";

import { TicketTagBadges } from "@/components/ticket-tag-badges";

import { Badge } from "@/components/ui/badge";

import { WireAiBanner } from "@/components/wireframe/wire-ai-banner";

import { SlaCountdown } from "@/components/sla-countdown";

import { hasTicketConnections, ticketOverviewHref } from "@/lib/ticket-connections";
import { priorityLabel, statusLabel, ticketTypeLabel } from "@/lib/ticket-labels";
import { ticketSourceLabelDa } from "@/lib/ticket-source-label";

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

    <div className="flex justify-between gap-2 border-b border-[var(--gray-border)] py-1.5 text-xs last:border-b-0">

      <span className="text-[var(--gray-mid)] font-medium">{label}</span>

      <span className="text-right font-medium">{value}</span>

    </div>

  );

}



function WireDetailCard({

  title,

  children,

  id,

}: {

  title: string;

  children: ReactNode;

  id?: string;

}) {

  return (

    <section id={id} className="wire-card mb-0 scroll-mt-4">

      <h2 className="wire-card-title">{title}</h2>

      {children}

    </section>

  );

}



function TicketMetadataCard({ ticket }: { ticket: TicketDetail }) {
  const routing = ticket.routing;

  return (

    <WireDetailCard title="Detaljer">

      <dl>

        <DetailField label="Kategori" value={ticket.category_name_da ?? "—"} />

        <DetailField label="Underkategori" value={ticket.subcategory_name_da ?? "—"} />

        <DetailField
          label="Prioritet"
          value={
            <span>
              {priorityLabel(ticket.priority)}
              {routing && routing.computed_priority !== ticket.priority ? (
                <span className="text-muted-foreground ml-1 block text-[11px] font-normal">
                  Foreslået: {routing.computed_priority_label_da}
                </span>
              ) : null}
            </span>
          }
        />

        {routing ? (
          <DetailField
            label="Routing-klarhed"
            value={`${routing.completeness_score}%${routing.routing_ready ? " ✓" : ""}`}
          />
        ) : null}

        <DetailField label="Type" value={ticketTypeLabel(ticket.ticket_type)} />

        <DetailField
          label="Kilde"
          value={ticket.source_label_da ?? ticketSourceLabelDa(ticket.source)}
        />

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

        <DetailField label="Responsfrist" value={formatDate(ticket.response_due_at)} />

        <DetailField

          label="Løsningsfrist"

          value={

            <div className="space-y-2">

              <span>{formatDate(ticket.resolution_due_at)}</span>

              <SlaCountdown

                status={ticket.status}

                resolutionDueAt={ticket.resolution_due_at}

                slaRemainingSeconds={ticket.sla_remaining_seconds}

                slaBreached={ticket.sla_breached}

                compact

              />

            </div>

          }

        />

      </dl>

    </WireDetailCard>

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

  const showLlmRail = staff && ticket.intelligence;

  const showAttachments = (ticket.attachments?.length ?? 0) > 0;

  const sidebarBlocks = (

    <>

      <TicketMetadataCard ticket={ticket} />

      {ticket.timestamps && ticket.activity ? (

        <TicketActivityPanel timestamps={ticket.timestamps} activity={ticket.activity} />

      ) : null}

      {staff ? (

        <WireDetailCard title="Tildeling og status" id="ticket-assign">

          <div className="space-y-4">

            <TicketMetadataForm ticket={ticket} staff={staff} />

            <TicketPriorityForm
              ticketId={ticket.id}
              currentPriority={ticket.priority}
              routing={ticket.routing}
            />

            <TicketStatusForm ticketId={ticket.id} currentStatus={ticket.status} />

            {teams.length === 0 ? (
              <TicketAssignmentForm
                ticketId={ticket.id}
                teams={teams}
                currentTeamId={ticket.assigned_team_id}
                currentUserId={ticket.assigned_user_id}
              />
            ) : null}

          </div>

        </WireDetailCard>

      ) : null}

    </>

  );



  return (

    <article className="wire-scroll-content space-y-4">

      <Link

        href="/tickets"

        className="text-[var(--gray-mid)] hover:text-star-navy inline-flex items-center gap-1 text-xs font-medium"

      >

        ← Tilbage til sager

      </Link>



      {ticket.routing && !ticket.routing.routing_ready ? (
        <RoutingReadinessBanner routing={ticket.routing} />
      ) : null}

      {showLlmRail ? (

        <WireAiBanner>

          {ticket.routing?.suggested_team_name && !ticket.assigned_team_id
            ? `AI foreslår ${ticket.routing.suggested_team_name} (${ticket.routing.routing_confidence ?? "—"}% match) — se panel til højre.`
            : "AI foreslår lignende sager og tildeling — se panel til højre."}

        </WireAiBanner>

      ) : null}

      {staff ? (
        <TicketDetailTopBand
          ticket={ticket}
          teams={teams}
          editableAssignment={teams.length > 0}
        />
      ) : null}

      <header className="wire-card mb-0">

        <div className="flex flex-wrap items-center gap-3">

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

          <SlaCountdown

            status={ticket.status}

            resolutionDueAt={ticket.resolution_due_at}

            slaRemainingSeconds={ticket.sla_remaining_seconds}

            slaBreached={ticket.sla_breached}

          />

          <Badge variant="outline" className="text-xs font-semibold">
            Kilde: {ticket.source_label_da ?? ticketSourceLabelDa(ticket.source)}
          </Badge>

        </div>

        <h1 className="text-star-navy mt-4 flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">

          {ticket.emoji ? (

            <span className="text-3xl leading-none" aria-hidden>

              {ticket.emoji}

            </span>

          ) : null}

          {ticket.title}

        </h1>

        {hasTicketConnections(ticket) ? (
          <div className="mt-4">
            <Link
              href={ticketOverviewHref(ticket.id)}
              className="border-star-navy bg-star-navy/5 text-star-navy hover:bg-star-navy inline-flex items-center gap-2 rounded-[2px] border px-3 py-2 text-xs font-bold tracking-wide uppercase transition-colors hover:text-white"
            >
              Oversigt / Tilknyttede sager
            </Link>
          </div>
        ) : null}

        {staff ? (

          <div className="mt-5 space-y-3">

            <div className="flex flex-wrap items-center gap-2">

              <TicketDetailActions ticketId={ticket.id} currentStatus={ticket.status} />

              <TicketSlackPush

                ticketId={ticket.id}

                ticketNumber={ticket.ticket_number}

                ticketTitle={ticket.title}

              />

            </div>

            <div>

              <KnowledgeArticlePromoteButton ticket={ticket} />

            </div>

          </div>

        ) : null}

      </header>



      <div

        className={

          showLlmRail

            ? "detail-layout"

            : "grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,22rem)]"

        }

      >

        <div className="min-w-0 space-y-4">

          <WireDetailCard title="Beskrivelse">

            <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">

              {ticket.description}

            </p>

          </WireDetailCard>



          {(ticket.tags?.length ?? 0) > 0 ? (

            <WireDetailCard title="Tags">

              <TicketTagBadges tags={ticket.tags} emoji={ticket.emoji} maxTags={10} />

            </WireDetailCard>

          ) : null}



          {showAttachments ? (

            <TicketAttachments

              ticketId={ticket.id}

              attachments={ticket.attachments ?? []}

              staffView={staff}

            />

          ) : null}



          <WireDetailCard title="Kommentarer">

            <TicketComments

              ticketId={ticket.id}

              comments={ticket.comments}

              staffView={staff}

              embedded

            />

            <div className="border-star-navy/10 mt-4 border-t pt-4">

              <p className="wire-form-label mb-2">Ny kommentar</p>

              <CommentForm
                ticketId={ticket.id}
                staffMode={staff}
                primaryNavy
                canBroadcastToChildren={Boolean(
                  ticket.is_major && !ticket.parent_ticket_id,
                )}
                childCount={ticket.children?.length ?? ticket.child_count ?? 0}
              />

            </div>

          </WireDetailCard>

          {(staff || (ticket.ticket_emails?.length ?? 0) > 0) ? (
            <WireDetailCard title="E-mail tråd">
              <TicketEmailThread
                ticketId={ticket.id}
                ticketNumber={ticket.ticket_number}
                linkedAddress={ticket.linked_gmail_email}
                emails={ticket.ticket_emails ?? []}
              />
            </WireDetailCard>
          ) : null}



          <TicketHierarchySection ticket={ticket} staffView={staff} />

        </div>

        <aside
          className={
            showLlmRail ? "detail-layout-rail space-y-4" : "space-y-4"
          }
          aria-label={showLlmRail ? "Semantik og tildeling" : "Sag metadata"}
        >
          {showLlmRail ? (
            <TicketIntelligencePanel
              ticketId={ticket.id}
              intelligence={ticket.intelligence!}
              routing={ticket.routing}
            />
          ) : null}
          {sidebarBlocks}
        </aside>

      </div>

    </article>

  );

}




