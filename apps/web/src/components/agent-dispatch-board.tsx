"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AssignmentDropDialog } from "@/components/assignment-drop-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClearFiltersButton } from "@/components/clear-filters-button";
import { SecurityTicketFilter } from "@/components/security-ticket-filter";
import { useListFilters } from "@/hooks/use-list-filters";
import { DispatchTeamsRail } from "@/components/dispatch/dispatch-teams-rail";
import { ResizableSplit } from "@/components/ui/resizable-split";
import { TicketSearchInput } from "@/components/ticket-search-input";
import { SlaCountdown } from "@/components/sla-countdown";
import { TicketTagBadges } from "@/components/ticket-tag-badges";
import { apiPatch } from "@/lib/api";
import { partitionTeamsByCategory } from "@/lib/team-categories";
import {
  serviceDeskTeamIds,
  teamsForServiceDeskRail,
  ticketsForServiceDeskTable,
} from "@/lib/service-desk-queue";
import { buildOpenAssignedTicketsByTeamMap } from "@/lib/team-group-view";
import {
  mergeTicketAssignmentInList,
  reconcileLocalTicketsWithServer,
} from "@/lib/ticket-assignment";
import { getClientUser } from "@/lib/auth";
import { ticketMatchesSearch } from "@/lib/ticket-tags";
import { ticketSourceLabelDa } from "@/lib/ticket-source-label";
import { priorityLabel, statusLabel } from "@/lib/ticket-labels";
import type { Team } from "@/types/team";
import type { Ticket, TicketDetail } from "@/types/ticket";

const DRAG_TYPE = "application/x-stardesk-ticket";

function readDraggedTicketId(dataTransfer: DataTransfer): string {
  const fromCustom = dataTransfer.getData(DRAG_TYPE);
  if (fromCustom) {
    return fromCustom;
  }
  const plain = dataTransfer.getData("text/plain");
  if (plain && /^[0-9a-f-]{36}$/i.test(plain)) {
    return plain;
  }
  return "";
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) {
    return "—";
  }
  return new Intl.DateTimeFormat("da-DK", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

function sortTeams(teams: Team[]): Team[] {
  return [...teams].sort((a, b) => {
    if (a.name === "SF") {
      return -1;
    }
    if (b.name === "SF") {
      return 1;
    }
    return a.name.localeCompare(b.name, "da");
  });
}

type PendingDrop = Readonly<{
  ticketId: string;
  ticketTitle: string;
  teamId?: string;
  teamName?: string;
}>;

export function AgentDispatchBoard({
  tickets,
  teams,
}: {
  tickets: Ticket[];
  teams: Team[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingDrop | null>(null);
  const [dragOverTeamId, setDragOverTeamId] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [localTickets, setLocalTickets] = useState(tickets);

  useEffect(() => {
    setLocalTickets((prev) => reconcileLocalTicketsWithServer(prev, tickets));
  }, [tickets]);

  const {
    search: searchQuery,
    setSearch: setSearchQuery,
    filters,
    setFilter,
    reset: resetFilters,
    hasActiveFilters,
  } = useListFilters({
    defaultFilters: { securityOnly: "false" },
  });
  const securityOnly = filters.securityOnly === "true";
  const setSecurityOnly = (checked: boolean) =>
    setFilter("securityOnly", checked ? "true" : "false");

  const currentUser = getClientUser();
  const isOrgAgent =
    currentUser?.role === "agent" && Boolean(currentUser.organization_name);
  const { internal: internalTeams } = useMemo(
    () => partitionTeamsByCategory(teams),
    [teams],
  );
  const sortedTeams = useMemo(() => sortTeams(internalTeams), [internalTeams]);
  const deskTeamIds = useMemo(() => serviceDeskTeamIds(sortedTeams), [sortedTeams]);
  const railTeams = useMemo(
    () => teamsForServiceDeskRail(sortedTeams, deskTeamIds),
    [sortedTeams, deskTeamIds],
  );

  const openTickets = useMemo(
    () =>
      [...localTickets]
        .filter((t) => !["closed", "cancelled"].includes(t.status))
        .filter((t) => ticketMatchesSearch(t, searchQuery))
        .filter((t) => !securityOnly || Boolean(t.is_security_ticket))
        .sort((a, b) => {
          if (a.is_major !== b.is_major) {
            return a.is_major ? -1 : 1;
          }
          if (Boolean(a.is_security_ticket) !== Boolean(b.is_security_ticket)) {
            return a.is_security_ticket ? -1 : 1;
          }
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }),
    [localTickets, searchQuery, securityOnly],
  );

  const tableTickets = useMemo(
    () => ticketsForServiceDeskTable(openTickets, deskTeamIds),
    [openTickets, deskTeamIds],
  );

  const ticketsByTeam = useMemo(
    () => buildOpenAssignedTicketsByTeamMap(openTickets),
    [openTickets],
  );

  const handleSelectTeam = useCallback((teamId: string | null) => {
    setSelectedTeamId(teamId);
  }, []);

  const handleDragOverTeam = useCallback((teamId: string, event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverTeamId(teamId);
  }, []);

  const handleDragLeaveTeam = useCallback(() => {
    setDragOverTeamId(null);
  }, []);

  function handleDragStart(ticketId: string) {
    return (event: React.DragEvent) => {
      event.dataTransfer.setData(DRAG_TYPE, ticketId);
      event.dataTransfer.setData("text/plain", ticketId);
      event.dataTransfer.effectAllowed = "move";
    };
  }

  function handleDrop(team: Team) {
    return (event: React.DragEvent) => {
      event.preventDefault();
      setDragOverTeamId(null);
      const ticketId = readDraggedTicketId(event.dataTransfer);
      if (!ticketId) {
        return;
      }
      const ticket = tableTickets.find((t) => t.id === ticketId);
      if (!ticket) {
        return;
      }
      setPending({
        ticketId,
        ticketTitle: ticket.title,
        teamId: team.id,
        teamName: team.name,
      });
    };
  }

  function openAssignDialog(ticket: Ticket) {
    setPending({
      ticketId: ticket.id,
      ticketTitle: ticket.title,
    });
  }

  async function confirmAssignment(data: {
    teamId: string;
    reason: string;
    faultDisplayed: boolean;
  }) {
    if (!pending) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const detail = await apiPatch<TicketDetail>(
        `/api/v1/tickets/${pending.ticketId}/assignment`,
        {
          assigned_team_id: data.teamId,
          assigned_user_id: null,
          assignment_reason: data.reason,
          fault_displayed: data.faultDisplayed,
        },
      );
      setLocalTickets((prev) =>
        mergeTicketAssignmentInList(prev, pending.ticketId, detail),
      );
      setPending(null);
      setSelectedTeamId(data.teamId);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke tildele sagen");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <ResizableSplit
        storageKey="stardesk-dispatch-board"
        defaultSizes={[68, 32]}
        minSizes={[42, 22]}
        className="min-h-[28rem] gap-0"
      >
        <section
          className="star-section-card overflow-hidden"
          aria-labelledby="dispatch-tickets-heading"
        >
          <div className="star-section-header">
            <h2 id="dispatch-tickets-heading" className="star-section-title">
              Sagsoversigt
            </h2>
            <p className="star-section-desc">
              {isOrgAgent
                ? `Viser sager for ${currentUser?.organization_name ?? "din organisation"}. Træk til en anden gruppe for at videresende.`
                : "Træk en sag til en gruppe til højre, eller brug knappen Tildel til gruppe."}{" "}
              Store sager er markeret med badge.
            </p>
          </div>
          <div className="star-section-body space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <TicketSearchInput value={searchQuery} onChange={setSearchQuery} />
                <ClearFiltersButton onClick={resetFilters} visible={hasActiveFilters} />
              </div>
              <SecurityTicketFilter
                id="dispatch-security-only"
                checked={securityOnly}
                onChange={setSecurityOnly}
              />
            </div>
            <div className="star-table-wrap">
            {tableTickets.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Ingen sager i kø — tildelte sager vises under grupper til højre.
              </p>
            ) : (
              <Table>
                <TableCaption className="sr-only">
                  Åbne sager. Træk en række til en gruppe til højre for at tildele.
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Sagsnr.</TableHead>
                    <TableHead scope="col">Titel</TableHead>
                    <TableHead scope="col">Kilde</TableHead>
                    <TableHead scope="col">Tags / emoji</TableHead>
                    <TableHead scope="col">Status</TableHead>
                    <TableHead scope="col">Prioritet</TableHead>
                    <TableHead scope="col">SLA</TableHead>
                    <TableHead scope="col">Gruppe</TableHead>
                    <TableHead scope="col">Fejlviseret</TableHead>
                    <TableHead scope="col">Oprettet</TableHead>
                    <TableHead scope="col">
                      <span className="sr-only">Handling</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableTickets.map((ticket) => (
                    <TableRow
                      key={ticket.id}
                      draggable
                      onDragStart={handleDragStart(ticket.id)}
                      aria-label={`Sag ${ticket.ticket_number}: ${ticket.title}`}
                      className="cursor-grab active:cursor-grabbing"
                    >
                      <TableCell className="font-mono text-xs">
                        <Link
                          href={`/tickets/${ticket.id}`}
                          className="text-star-blue font-semibold hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {ticket.ticket_number}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-[12rem]">
                        <div className="flex flex-wrap items-center gap-1">
                          {ticket.is_major ? (
                            <Badge variant="destructive" aria-label="Stor sag">
                              Stor sag
                            </Badge>
                          ) : null}
                          {ticket.is_security_ticket ? (
                            <Badge
                              variant="outline"
                              className="border-amber-600 text-amber-800"
                              aria-label="Sikkerhedssag"
                            >
                              Sikkerhed
                            </Badge>
                          ) : null}
                          <Link
                            href={`/tickets/${ticket.id}`}
                            className="text-star-blue truncate font-medium hover:underline"
                          >
                            {ticket.title}
                          </Link>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[6rem]">
                        <Badge variant="outline" className="whitespace-nowrap text-[10px]">
                          {ticket.source_label_da ?? ticketSourceLabelDa(ticket.source)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[8rem]">
                        <TicketTagBadges tags={ticket.tags} emoji={ticket.emoji} />
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{statusLabel(ticket.status)}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge>{priorityLabel(ticket.priority)}</Badge>
                      </TableCell>
                      <TableCell>
                        <SlaCountdown
                          status={ticket.status}
                          resolutionDueAt={ticket.resolution_due_at}
                          slaRemainingSeconds={ticket.sla_remaining_seconds}
                          slaBreached={ticket.sla_breached}
                          compact
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {ticket.assigned_team_name ?? "—"}
                      </TableCell>
                      <TableCell>
                        {ticket.fault_displayed ? (
                          <Badge variant="secondary">Ja</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">Nej</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                        {formatDate(ticket.created_at)}
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openAssignDialog(ticket)}
                        >
                          Tildel til gruppe
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            </div>
          </div>
        </section>

        <DispatchTeamsRail
          teams={railTeams}
          ticketsByTeam={ticketsByTeam}
          dragOverTeamId={dragOverTeamId}
          onDragOverTeam={handleDragOverTeam}
          onDragLeaveTeam={handleDragLeaveTeam}
          onDropTeam={handleDrop}
          selectedTeamId={selectedTeamId}
          onSelectTeam={handleSelectTeam}
          title="Grupper"
          description="Klik en gruppe for alle sager — træk hertil for at tildele"
        />
      </ResizableSplit>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      {pending ? (
        <AssignmentDropDialog
          ticketTitle={pending.ticketTitle}
          teamName={pending.teamName}
          teamId={pending.teamId}
          teams={sortedTeams}
          onConfirm={confirmAssignment}
          onCancel={() => !isSaving && setPending(null)}
        />
      ) : null}
    </>
  );
}
