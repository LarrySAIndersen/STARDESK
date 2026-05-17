"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { apiPatch } from "@/lib/api";
import type { Ticket } from "@/types/ticket";

const CLOSED = new Set(["resolved", "closed", "cancelled"]);

export function TicketDetailActions({
  ticketId,
  currentStatus,
}: {
  ticketId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"resolve" | "close" | null>(null);

  const isClosed = CLOSED.has(currentStatus);

  async function setStatus(status: "resolved" | "closed") {
    setBusy(status === "resolved" ? "resolve" : "close");
    try {
      await apiPatch<Ticket>(`/api/v1/tickets/${ticketId}`, { status });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  function scrollToAssign() {
    document.getElementById("ticket-assign")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        className="border-star-navy/30 text-star-navy hover:bg-star-blue-light rounded-sm"
        onClick={scrollToAssign}
      >
        Tildel
      </Button>
      <Button
        type="button"
        variant="outline"
        className="border-star-navy/30 text-star-navy hover:bg-star-blue-light rounded-sm"
        disabled={isClosed || busy !== null || currentStatus === "resolved"}
        onClick={() => setStatus("resolved")}
      >
        {busy === "resolve" ? "Løser…" : "Løs"}
      </Button>
      <Button
        type="button"
        className="bg-star-navy hover:bg-star-blue rounded-sm"
        disabled={isClosed || busy !== null || currentStatus === "closed"}
        onClick={() => setStatus("closed")}
      >
        {busy === "close" ? "Lukker…" : "Luk"}
      </Button>
    </div>
  );
}
