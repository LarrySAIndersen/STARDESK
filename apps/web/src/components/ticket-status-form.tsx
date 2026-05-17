"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { apiPatch } from "@/lib/api";
import { statusLabel } from "@/lib/ticket-labels";
import type { Ticket } from "@/types/ticket";

const STATUSES = [
  "new",
  "assigned",
  "in_progress",
  "on_hold",
  "resolved",
  "closed",
  "cancelled",
] as const;

const selectClassName =
  "border-input bg-background mt-2 flex h-9 w-full rounded-md border px-3 py-1 text-sm";

export function TicketStatusForm({
  ticketId,
  currentStatus,
}: {
  ticketId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleUpdate() {
    setIsSubmitting(true);
    try {
      await apiPatch<Ticket>(`/api/v1/tickets/${ticketId}`, { status });
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="pt-4">
      <Label htmlFor="ticket-status">Opdater status</Label>
      <select
        id="ticket-status"
        className={selectClassName}
        value={status}
        onChange={(event) => setStatus(event.target.value)}
      >
        {STATUSES.map((value) => (
          <option key={value} value={value}>
            {statusLabel(value)}
          </option>
        ))}
      </select>
      <Button
        type="button"
        size="sm"
        className="mt-2 w-full"
        disabled={isSubmitting || status === currentStatus}
        onClick={handleUpdate}
      >
        {isSubmitting ? "Gemmer…" : "Gem status"}
      </Button>
    </div>
  );
}

