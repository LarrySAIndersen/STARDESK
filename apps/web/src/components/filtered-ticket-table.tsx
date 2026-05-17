"use client";

import { useMemo, useState } from "react";

import { ItilTicketTable } from "@/components/itil-ticket-table";
import { SecurityTicketFilter } from "@/components/security-ticket-filter";
import type { Ticket } from "@/types/ticket";

export function FilteredTicketTable({
  tickets,
  compact = false,
  showSecurityFilter = true,
}: {
  tickets: Ticket[];
  compact?: boolean;
  showSecurityFilter?: boolean;
}) {
  const [securityOnly, setSecurityOnly] = useState(false);

  const visible = useMemo(() => {
    if (!securityOnly) {
      return tickets;
    }
    return tickets.filter((ticket) => Boolean(ticket.is_security_ticket));
  }, [tickets, securityOnly]);

  return (
    <div className="space-y-3">
      {showSecurityFilter ? (
        <SecurityTicketFilter checked={securityOnly} onChange={setSecurityOnly} />
      ) : null}
      <ItilTicketTable tickets={visible} compact={compact} />
    </div>
  );
}
