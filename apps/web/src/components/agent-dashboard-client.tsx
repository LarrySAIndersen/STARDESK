"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AgentBottomPanel } from "@/components/agent-bottom-panel";
import { WireAiBanner } from "@/components/wireframe/wire-ai-banner";
import { WireframeTicketTable } from "@/components/wireframe/wireframe-ticket-table";
import { useBoardDataSync } from "@/hooks/use-board-data-sync";
import { isNewStatusTicket } from "@/lib/service-desk-queue";
import { mergeTicketAssignmentFromDetail } from "@/lib/ticket-assignment";
import { buildTicketsFilterHref } from "@/lib/dashboard-ticket-links";
import { firstUnassignedWithRouting } from "@/lib/ticket-routing";
import type { Team } from "@/types/team";
import type { Ticket, TicketDetail } from "@/types/ticket";

export function AgentDashboardClient({
  tickets: initialTickets,
  teams: initialTeams,
}: {
  tickets: Ticket[];
  teams: Team[];
}) {
  const [tickets, setTickets] = useState(initialTickets);
  const [teams, setTeams] = useState(initialTeams);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [draggingTicket, setDraggingTicket] = useState<Ticket | null>(null);
  const draggingTicketRef = useRef<Ticket | null>(null);
  const [slackTabRequest, setSlackTabRequest] = useState(0);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  useEffect(() => {
    setTickets(initialTickets);
  }, [initialTickets]);

  useEffect(() => {
    setTeams(initialTeams);
  }, [initialTeams]);

  useBoardDataSync({
    setTickets,
    setTeams,
    onError: setRefreshError,
  });

  const handleTicketAssigned = useCallback((detail: TicketDetail) => {
    setTickets((prev) => {
      const existing = prev.find((ticket) => ticket.id === detail.id);
      if (!existing) {
        return prev;
      }
      const merged = mergeTicketAssignmentFromDetail(existing, detail);
      setSelected(merged);
      return prev.map((ticket) => (ticket.id === merged.id ? merged : ticket));
    });
    draggingTicketRef.current = null;
    setDraggingTicket(null);
  }, []);

  /** Alle åbne sager med status Ny (nyeste først). */
  const newStatusTickets = useMemo(
    () =>
      tickets
        .filter(isNewStatusTicket)
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        ),
    [tickets],
  );

  useEffect(() => {
    const main = document.getElementById("main-content");
    if (!main) return;
    const obs = new MutationObserver(() => {
      const req = main.dataset.slackTabRequest;
      if (req) setSlackTabRequest(Number(req));
    });
    obs.observe(main, { attributes: true, attributeFilter: ["data-slack-tab-request"] });
    return () => obs.disconnect();
  }, []);

  const aiTicket = firstUnassignedWithRouting(tickets) ?? newStatusTickets[0];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="wire-scroll-content min-h-0 flex-1">
        {refreshError ? (
          <p className="text-star-red mb-3 px-1 text-sm" role="alert">
            {refreshError}
          </p>
        ) : null}
        {aiTicket ? (
          <WireAiBanner>
            <strong>
              {aiTicket.ticket_number} {aiTicket.title}
            </strong>{" "}
            {aiTicket.routing?.suggested_team_name && !aiTicket.assigned_team_id
              ? `— AI foreslår ${aiTicket.routing.suggested_team_name}. Træk til en gruppe i bundpanelet.`
              : "— træk sagen til en gruppe i bundpanelet for AI-assisteret tildeling."}
          </WireAiBanner>
        ) : null}

        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="wire-sec-title">
            Nye sager{" "}
            {newStatusTickets.length > 0 ? (
              <Link
                href={buildTicketsFilterHref({ scope: "all", status: "new", openOnly: true })}
                className="text-star-blue hover:text-star-navy tabular-nums hover:underline"
                aria-label={`${newStatusTickets.length} nye sager — åbn sagliste`}
              >
                ({newStatusTickets.length})
              </Link>
            ) : null}
          </h2>
          <Link
            href={buildTicketsFilterHref({ scope: "all", bucket: "modtaget" })}
            className="wire-btn wire-btn-sm"
          >
            Se alle →
          </Link>
        </div>
        {newStatusTickets.length === 0 ? (
          <p className="text-[var(--gray-mid)] text-sm">
            Ingen sager med status Ny. Når nye sager oprettes, vises de her til fordeling.
          </p>
        ) : (
          <WireframeTicketTable
            tickets={newStatusTickets}
            draggable
            onDragStart={(ticket) => {
              draggingTicketRef.current = ticket;
              setDraggingTicket(ticket);
            }}
            onDragEnd={() => {
              window.setTimeout(() => {
                draggingTicketRef.current = null;
                setDraggingTicket(null);
              }, 0);
            }}
            onRowClick={(t) => {
              setSelected(t);
              const panel = document.getElementById("dispatch-panel");
              panel?.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }}
          />
        )}
        <p className="mt-2 text-center text-[11px] text-[var(--gray-mid)]">
          Grib en sag og træk den ned til en gruppe — bereder-stregen lyser op mens du trækker
        </p>
      </div>

      <AgentBottomPanel
        tickets={tickets}
        teams={teams}
        slackTabRequest={slackTabRequest}
        selectedTicket={selected}
        draggingTicket={draggingTicket}
        onTicketAssigned={handleTicketAssigned}
      />
    </div>
  );
}
