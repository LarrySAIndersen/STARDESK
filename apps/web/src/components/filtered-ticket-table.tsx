"use client";

import { useMemo } from "react";

import { ClearFiltersButton } from "@/components/clear-filters-button";
import { ItilTicketTable } from "@/components/itil-ticket-table";
import { SecurityTicketFilter } from "@/components/security-ticket-filter";
import { useListFilters } from "@/hooks/use-list-filters";
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
  const { filters, setFilter, reset, hasActiveFilters } = useListFilters({
    defaultFilters: { securityOnly: "false" },
  });
  const securityOnly = filters.securityOnly === "true";

  const visible = useMemo(() => {
    if (!securityOnly) {
      return tickets;
    }
    return tickets.filter((ticket) => Boolean(ticket.is_security_ticket));
  }, [tickets, securityOnly]);

  return (
    <div className="space-y-3">
      {showSecurityFilter ? (
        <div className="flex flex-wrap items-center gap-3">
          <SecurityTicketFilter
            checked={securityOnly}
            onChange={(checked) => setFilter("securityOnly", checked ? "true" : "false")}
          />
          <ClearFiltersButton onClick={reset} visible={hasActiveFilters} />
        </div>
      ) : null}
      <ItilTicketTable tickets={visible} compact={compact} />
    </div>
  );
}
