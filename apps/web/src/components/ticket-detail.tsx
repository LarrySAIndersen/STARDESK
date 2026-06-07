import Link from "next/link";

import type { ReactNode } from "react";

import { KnowledgeArticlePromoteButton } from "@/components/knowledge-article-promote-button";
import { RoutingReadinessBanner } from "@/components/routing-readiness-banner";
import { TicketActivityPanel } from "@/components/ticket-activity-panel";
import { TicketAssignmentForm } from "@/components/ticket-assignment-form";
import { TicketDetailActions } from "@/components/ticket-detail-actions";
import { TicketEmailThread } from "@/components/ticket-email-thread";
import { TicketHierarchySection } from "@/components/ticket-hierarchy-section";
import { TicketIntelligencePanel } from "@/components/ticket-intelligence-panel";
import { TicketMetadataForm } from "@/components/ticket-metadata-form";
import { TicketPriorityForm } from "@/components/ticket-priority-form";
import { TicketSlackPush } from "@/components/ticket-slack-push";
import { TicketTagBadges } from "@/components/ticket-tag-badges";
import { TicketPostItsPanel } from "@/components/personal/ticket-post-its-panel";
import { TicketCaseLayout } from "@/components/ticket/ticket-case-layout";
import { TicketDetailTopBand } from "@/components/ticket/ticket-detail-top-band";
import { TicketCaseImageStripSection } from "@/components/ticket/ticket-case-image-strip-section";
import { Badge } from "@/components/ui/badge";
import { WireAiBanner } from "@/components/wireframe/wire-ai-banner";
import { SlaCountdown } from "@/components/sla-countdown";
import { hasTicketConnections, ticketOverviewHref } from "@/lib/ticket-connections";
import { priorityLabel, ticketTypeLabel } from "@/lib/ticket-labels";
import { ticketSourceLabelDa } from "@/lib/ticket-source-label";
import { isStaff } from "@/lib/auth";
import type { Category } from "@/types/category";
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
    <div className="flex justify-between gap-2 border-b border-border py-1.5 text-xs last:border-b-0">
      <span className="text-muted-foreground font-medium">{label}</span>
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
    <section id={id} className="portal-v2-card scroll-mt-4 p-4 sm:p-5">
      <h2 className="portal-v2-section-title mb-3">{title}</h2>
      {children}
    </section>
  );
}

function TicketMetadataCard({ ticket }: { ticket: TicketDetail }) {
  const routing = ticket.routing;

  return (
    <WireDetailCard title="Udvidet metadata">
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

function StaffCaseBreadcrumb({ ticketNumber }: { ticketNumber: string }) {
  return (
    <nav className="portal-v2-breadcrumb text-[12px]" aria-label="Brødkrumme">
      <Link href="/tickets" className="portal-v2-breadcrumb-link">
        Sager
      </Link>
      <span className="text-foreground font-medium">{ticketNumber}</span>
    </nav>
  );
}

export function TicketDetailView({
  ticket,
  currentUser,
  teams = [],
  categories = [],
}: {
  ticket: TicketDetail;
  currentUser: User | null;
  teams?: Team[];
  categories?: Category[];
}) {
  const staff = isStaff(currentUser);
  const metadataEditable =
    staff && teams.length > 0 && categories.length > 0;
  const showLlmRail = staff && ticket.intelligence;

  const staffBelow = staff ? (
    <>
      {ticket.routing && !ticket.routing.routing_ready ? (
        <RoutingReadinessBanner routing={ticket.routing} />
      ) : null}

      {showLlmRail ? (
        <WireAiBanner>
          {ticket.routing?.suggested_team_name && !ticket.assigned_team_id
            ? `AI foreslår ${ticket.routing.suggested_team_name} (${ticket.routing.routing_confidence ?? "—"}% match) — se panel nedenfor.`
            : "AI foreslår lignende sager og tildeling — se panel nedenfor."}
        </WireAiBanner>
      ) : null}

      {hasTicketConnections(ticket) ? (
        <WireDetailCard title="Tilknyttede sager">
          <Link
            href={ticketOverviewHref(ticket.id)}
            className="border-primary bg-primary/5 text-primary hover:bg-primary inline-flex items-center gap-2 rounded-[2px] border px-3 py-2 text-xs font-bold tracking-wide uppercase transition-colors hover:text-primary-foreground"
          >
            Oversigt / Tilknyttede sager
          </Link>
        </WireDetailCard>
      ) : null}

      {currentUser ? (
        <TicketPostItsPanel ticketId={ticket.id} currentUserId={currentUser.id} />
      ) : null}

      <WireDetailCard title="Handlinger">
        <div className="flex flex-wrap items-center gap-2">
          <TicketDetailActions ticketId={ticket.id} currentStatus={ticket.status} />
          <TicketSlackPush
            ticketId={ticket.id}
            ticketNumber={ticket.ticket_number}
            ticketTitle={ticket.title}
          />
        </div>
        <div className="mt-4">
          <KnowledgeArticlePromoteButton ticket={ticket} />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {ticket.is_major ? <Badge variant="destructive">Stor sag</Badge> : null}
          {ticket.is_security_ticket ? (
            <Badge variant="outline" className="border-amber-600 text-amber-800">
              Sikkerhedssag
            </Badge>
          ) : null}
        </div>
      </WireDetailCard>

      {!metadataEditable ? (
        <TicketDetailTopBand
          ticket={ticket}
          teams={teams}
          categories={categories}
          editableMetadata={false}
          staffView={staff}
        />
      ) : null}

      {(ticket.tags?.length ?? 0) > 0 ? (
        <WireDetailCard title="Tags">
          <TicketTagBadges tags={ticket.tags} emoji={ticket.emoji} maxTags={10} />
        </WireDetailCard>
      ) : null}

      <WireDetailCard title="Billeder og vedhæftninger (redigering)">
        <TicketCaseImageStripSection
          ticketId={ticket.id}
          attachments={ticket.attachments ?? []}
          staffView={staff}
        />
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

      {showLlmRail ? (
        <TicketIntelligencePanel
          ticketId={ticket.id}
          intelligence={ticket.intelligence!}
          routing={ticket.routing}
        />
      ) : null}

      <TicketMetadataCard ticket={ticket} />

      {ticket.timestamps && ticket.activity ? (
        <WireDetailCard title="Aktivitet">
          <TicketActivityPanel timestamps={ticket.timestamps} activity={ticket.activity} />
        </WireDetailCard>
      ) : null}

      {!metadataEditable ? (
        <WireDetailCard title="Tildeling og status" id="ticket-assign">
          <div className="space-y-4">
            <TicketMetadataForm ticket={ticket} staff={staff} />
            <TicketPriorityForm
              ticketId={ticket.id}
              currentPriority={ticket.priority}
              routing={ticket.routing}
            />
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
  ) : null;

  if (staff) {
    return (
      <article className="min-h-0 flex-1">
        <TicketCaseLayout
          ticket={ticket}
          staffView
          editableDetails={metadataEditable}
          teams={teams}
          categories={categories}
          breadcrumb={<StaffCaseBreadcrumb ticketNumber={ticket.ticket_number} />}
          below={staffBelow}
        />
      </article>
    );
  }

  return (
    <article className="min-h-0 flex-1">
      <TicketCaseLayout ticket={ticket} staffView={false} />
    </article>
  );
}
