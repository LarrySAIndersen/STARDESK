"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { AssignmentDropDialog } from "@/components/assignment-drop-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiPatch } from "@/lib/api";
import { priorityLabel, statusLabel } from "@/lib/ticket-labels";
import type { Team } from "@/types/team";
import type { Ticket } from "@/types/ticket";

const DRAG_TYPE = "application/x-stardesk-ticket";

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

type PendingDrop = {
  ticketId: string;
  ticketTitle: string;
  teamId: string;
  teamName: string;
};

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
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const sortedTeams = useMemo(() => sortTeams(teams), [teams]);

  const openTickets = useMemo(
    () =>
      [...tickets]
        .filter((t) => !["closed", "cancelled"].includes(t.status))
        .sort((a, b) => {
          if (a.is_major !== b.is_major) {
            return a.is_major ? -1 : 1;
          }
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }),
    [tickets],
  );

  const ticketsByTeam = useMemo(() => {
    const map = new Map<string, number>();
    for (const ticket of openTickets) {
      if (ticket.assigned_team_id) {
        map.set(ticket.assigned_team_id, (map.get(ticket.assigned_team_id) ?? 0) + 1);
      }
    }
    return map;
  }, [openTickets]);

  function handleDragStart(ticketId: string, title: string) {
    return (event: React.DragEvent) => {
      event.dataTransfer.setData(DRAG_TYPE, ticketId);
      event.dataTransfer.setData("text/plain", title);
      event.dataTransfer.effectAllowed = "move";
    };
  }

  function handleDrop(team: Team) {
    return (event: React.DragEvent) => {
      event.preventDefault();
      setDragOverTeamId(null);
      const ticketId = event.dataTransfer.getData(DRAG_TYPE);
      if (!ticketId) {
        return;
      }
      const ticket = openTickets.find((t) => t.id === ticketId);
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

  async function confirmAssignment(data: { reason: string; faultDisplayed: boolean }) {
    if (!pending) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await apiPatch(`/api/v1/tickets/${pending.ticketId}/assignment`, {
        assigned_team_id: pending.teamId,
        assigned_user_id: null,
        assignment_reason: data.reason,
        fault_displayed: data.faultDisplayed,
      });
      setPending(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke tildele sagen");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(280px,340px)]">
        <section className="star-section-card overflow-hidden">
          <div className="star-section-header">
            <h2 className="star-section-title">Sagsoversigt</h2>
            <p className="star-section-desc">
              Træk en sag til en gruppe til højre. Store sager er markeret med rød badge.
            </p>
          </div>
          <div className="star-section-body star-table-wrap">
            {openTickets.length === 0 ? (
              <p className="text-muted-foreground text-sm">Ingen åbne sager.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sagsnr.</TableHead>
                    <TableHead>Titel</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Prioritet</TableHead>
                    <TableHead>Gruppe</TableHead>
                    <TableHead>Fejlviseret</TableHead>
                    <TableHead>Oprettet</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {openTickets.map((ticket) => (
                    <TableRow
                      key={ticket.id}
                      draggable
                      onDragStart={handleDragStart(ticket.id, ticket.title)}
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
                            <Badge variant="destructive" className="text-[10px]">
                              Stor sag
                            </Badge>
                          ) : null}
                          <span className="truncate font-medium">{ticket.title}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{statusLabel(ticket.status)}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge>{priorityLabel(ticket.priority)}</Badge>
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </section>

        <aside className="space-y-3">
          <div className="star-section-header rounded-t-md">
            <h2 className="star-section-title">Grupper</h2>
            <p className="star-section-desc">Slip sagen her for at tildele</p>
          </div>
          {sortedTeams.map((team) => {
            const count = ticketsByTeam.get(team.id) ?? 0;
            const isOver = dragOverTeamId === team.id;
            return (
              <div
                key={team.id}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setDragOverTeamId(team.id);
                }}
                onDragLeave={() => setDragOverTeamId(null)}
                onDrop={handleDrop(team)}
                className={`rounded-md border-2 border-dashed p-4 transition-colors ${
                  isOver
                    ? "border-star-blue bg-star-blue-light"
                    : "border-star-blue/30 bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-star-navy font-semibold">{team.name}</p>
                    {team.name === "SF" ? (
                      <p className="text-star-blue text-[10px] font-medium uppercase">
                        Hovedgruppe
                      </p>
                    ) : null}
                  </div>
                  <Badge variant="outline">{count} sag{count === 1 ? "" : "er"}</Badge>
                </div>
                <p className="text-muted-foreground mt-2 text-xs">
                  {team.members.length} medlemmer
                </p>
              </div>
            );
          })}
        </aside>
      </div>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      {pending ? (
        <AssignmentDropDialog
          ticketTitle={pending.ticketTitle}
          teamName={pending.teamName}
          onConfirm={confirmAssignment}
          onCancel={() => !isSaving && setPending(null)}
        />
      ) : null}
    </>
  );
}
