"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { apiPatch } from "@/lib/api";
import { priorityLabel } from "@/lib/ticket-labels";
import type { TicketDetail, TicketRouting } from "@/types/ticket";

const PRIORITIES = ["critical", "high", "medium", "low"] as const;

const selectClassName =
  "border-input bg-background mt-2 flex h-9 w-full rounded-md border px-3 py-1 text-sm";

export function TicketPriorityForm({
  ticketId,
  currentPriority,
  routing,
}: {
  ticketId: string;
  currentPriority: string;
  routing?: TicketRouting | null;
}) {
  const router = useRouter();
  const [priority, setPriority] = useState(currentPriority);
  const [modalOpen, setModalOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pendingPriority, setPendingPriority] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const panelRef = useFocusTrap(modalOpen, () => setModalOpen(false));

  function requestChange(next: string) {
    if (next === currentPriority) return;
    setPendingPriority(next);
    setReason("");
    setError(null);
    setModalOpen(true);
  }

  async function confirmChange() {
    if (!pendingPriority) return;
    const trimmed = reason.trim();
    if (trimmed.length < 10) {
      setError("Begrundelse skal være mindst 10 tegn.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await apiPatch<TicketDetail>(`/api/v1/tickets/${ticketId}/priority`, {
        priority: pendingPriority,
        reason: trimmed,
      });
      setPriority(pendingPriority);
      setModalOpen(false);
      setPendingPriority(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke gemme prioritet");
    } finally {
      setIsSubmitting(false);
    }
  }

  const suggested = routing?.computed_priority;
  const showSuggestion = suggested && suggested !== currentPriority;

  return (
    <>
      <div className="border-t pt-4">
        <Label htmlFor="ticket-priority">Prioritet</Label>
        <select
          id="ticket-priority"
          className={selectClassName}
          value={priority}
          onChange={(e) => {
            setPriority(e.target.value);
            requestChange(e.target.value);
          }}
        >
          {PRIORITIES.map((value) => (
            <option key={value} value={value}>
              {priorityLabel(value)}
            </option>
          ))}
        </select>
        {showSuggestion && routing ? (
          <p className="text-muted-foreground mt-2 text-xs">
            Foreslået: <strong>{routing.computed_priority_label_da}</strong>
            {routing.computed_priority_reasons_da.length > 0
              ? ` — ${routing.computed_priority_reasons_da.slice(0, 2).join("; ")}`
              : null}
          </p>
        ) : null}
      </div>

      {modalOpen && pendingPriority ? (
        <div
          className="wire-confirm-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setModalOpen(false);
              setPriority(currentPriority);
            }
          }}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="wire-confirm-modal max-w-md"
          >
            <div className="border-b border-[var(--gray-border)] px-4 py-3.5">
              <h2 id={titleId} className="text-star-navy text-sm font-bold">
                Bekræft prioritetsændring
              </h2>
              <p className="text-[var(--gray-mid)] mt-1 text-[11px]">
                {priorityLabel(currentPriority)} → {priorityLabel(pendingPriority)}
              </p>
            </div>
            <div className="space-y-3 px-4 py-3.5">
              <div className="space-y-2">
                <Label htmlFor="priority-reason">
                  Begrundelse <span className="text-star-red">*</span>
                </Label>
                <Textarea
                  id="priority-reason"
                  rows={4}
                  className="wire-form-input min-h-[5rem]"
                  placeholder="Beskriv hvorfor prioriteten ændres…"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                {error ? (
                  <p className="text-star-red text-xs" role="alert">
                    {error}
                  </p>
                ) : null}
              </div>
              <div className="flex justify-end gap-2 border-t border-[var(--gray-border)] pt-3">
                <button
                  type="button"
                  className="wire-btn"
                  disabled={isSubmitting}
                  onClick={() => {
                    setModalOpen(false);
                    setPriority(currentPriority);
                    setPendingPriority(null);
                  }}
                >
                  Annuller
                </button>
                <Button
                  type="button"
                  className="wire-btn wire-btn-primary"
                  disabled={isSubmitting}
                  onClick={() => void confirmChange()}
                >
                  {isSubmitting ? "Gemmer…" : "Gem prioritet"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
