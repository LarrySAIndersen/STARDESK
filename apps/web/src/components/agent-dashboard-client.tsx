"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AgentBottomPanel } from "@/components/agent-bottom-panel";
import { WireAiBanner } from "@/components/wireframe/wire-ai-banner";
import { WireframeTicketTable } from "@/components/wireframe/wireframe-ticket-table";
import { apiGet } from "@/lib/api";
import { firstUnassignedWithRouting } from "@/lib/ticket-routing";
import type { Team } from "@/types/team";
import type { Ticket } from "@/types/ticket";

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
  const [slackTabRequest, setSlackTabRequest] = useState(0);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [freshTickets, freshTeams] = await Promise.all([
          apiGet<Ticket[]>("/api/v1/tickets?board=true&limit=500"),
          apiGet<Team[]>("/api/v1/teams"),
        ]);
        if (!cancelled) {
          setTickets(freshTickets);
          setTeams(freshTeams);
          setRefreshError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setRefreshError(
            error instanceof Error
              ? error.message
              : "Kunne ikke opdatere sager. Viser seneste kendte data.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const recentTickets = useMemo(
    () =>
      [...tickets]
        .filter((t) => !["closed", "cancelled"].includes(t.status))
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )
        .slice(0, 8),
    [tickets],
  );

  useEffect(() => {
    const main = document.getElementById("main-content");
    if (!main) return;
    const obs = new MutationObserver(() => {
      const req = main.getAttribute("data-slack-tab-request");
      if (req) setSlackTabRequest(Number(req));
    });
    obs.observe(main, { attributes: true, attributeFilter: ["data-slack-tab-request"] });
    return () => obs.disconnect();
  }, []);

  const aiTicket = firstUnassignedWithRouting(tickets) ?? recentTickets[0];

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
              ? `— AI foreslår ${aiTicket.routing.suggested_team_name}. Træk til tekniker i bundpanelet.`
              : "— træk sagen til en tekniker i bundpanelet for AI-assisteret tildeling."}
          </WireAiBanner>
        ) : null}

        <div className="mb-2 flex items-center justify-between">
          <h2 className="wire-sec-title">Seneste sager</h2>
          <Link href="/tickets" className="wire-btn wire-btn-sm">
            Se alle →
          </Link>
        </div>
        <WireframeTicketTable
          tickets={recentTickets}
          draggable
          onRowClick={(t) => {
            setSelected(t);
            const panel = document.getElementById("dispatch-panel");
            panel?.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }}
        />
        <p className="mt-2 text-center text-[11px] text-[var(--gray-mid)]">
          Grib en sag og træk den ned til en tekniker — AI viser konfidens-score mens du
          trækker
        </p>
      </div>

      <AgentBottomPanel
        tickets={tickets}
        teams={teams}
        slackTabRequest={slackTabRequest}
        selectedTicket={selected}
      />
    </div>
  );
}
