"use client";

import Link from "next/link";

import { statusLabel, priorityLabel } from "@/lib/ticket-labels";
import type { Ticket } from "@/types/ticket";

export function ClassicModuleTable({
  tickets,
  emptyMessage,
}: {
  tickets: Ticket[];
  emptyMessage: string;
}) {
  if (tickets.length === 0) {
    return <p className="classic-empty">{emptyMessage}</p>;
  }

  return (
    <div className="classic-table-wrap">
      <table className="classic-table">
        <thead>
          <tr>
            <th scope="col">Nummer</th>
            <th scope="col">Titel</th>
            <th scope="col">Status</th>
            <th scope="col">Prioritet</th>
            <th scope="col">Gruppe</th>
            <th scope="col">Behandler</th>
            <th scope="col">Oprettet</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => (
            <tr key={ticket.id}>
              <td>
                <Link href={`/classic/tickets/${ticket.id}`} className="classic-table__link">
                  {ticket.ticket_number}
                </Link>
              </td>
              <td className="classic-table__title">{ticket.title}</td>
              <td>{statusLabel(ticket.status)}</td>
              <td>{priorityLabel(ticket.priority)}</td>
              <td>{ticket.assigned_team_name ?? "—"}</td>
              <td>{ticket.assigned_user_name ?? "—"}</td>
              <td className="classic-table__date">
                {new Date(ticket.created_at).toLocaleDateString("da-DK")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
