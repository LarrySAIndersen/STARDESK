"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { WireStatusBadge } from "@/components/wireframe/wire-badge";
import { formatDateTimeDa } from "@/lib/utils";
import type { Ticket } from "@/types/ticket";

export function DepartmentTicketsBox({ tickets }: { tickets: Ticket[] }) {
  const [open, setOpen] = useState(true);

  if (tickets.length === 0) {
    return null;
  }

  return (
    <section className="portal-v2-card overflow-hidden">
      <button
        type="button"
        className="text-star-navy flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-[14px] font-semibold"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>Åbne sager i afdelingen ({tickets.length})</span>
        <ChevronDown
          className={`size-4 shrink-0 transition ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open ? (
        <ul className="border-t border-[var(--gray-border)] divide-y divide-[var(--gray-border)]">
          {tickets.slice(0, 8).map((ticket) => (
            <li key={ticket.id}>
              <Link
                href={`/portal-v2/sag/${ticket.id}`}
                className="hover:bg-star-navy/[0.03] flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
              >
                <div className="min-w-0">
                  <span className="text-[var(--gray-mid)] font-mono text-[11px] font-semibold">
                    {ticket.ticket_number}
                  </span>
                  <p className="truncate text-[13px] font-medium">{ticket.title}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <WireStatusBadge status={ticket.status} />
                  <span className="text-[var(--gray-mid)] text-[10px] tabular-nums">
                    {formatDateTimeDa(ticket.created_at)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
