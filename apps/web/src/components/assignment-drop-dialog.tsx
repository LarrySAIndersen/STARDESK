"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function AssignmentDropDialog({
  ticketTitle,
  teamName,
  onConfirm,
  onCancel,
}: {
  ticketTitle: string;
  teamName: string;
  onConfirm: (data: { reason: string; faultDisplayed: boolean }) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const [faultDisplayed, setFaultDisplayed] = useState(false);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assign-dialog-title"
    >
      <div className="bg-background w-full max-w-md rounded-lg border p-6 shadow-lg">
        <h2 id="assign-dialog-title" className="text-star-navy text-lg font-semibold">
          Tildel til {teamName}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">{ticketTitle}</p>

        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="assignment-reason">Årsag / bemærkning</Label>
            <Textarea
              id="assignment-reason"
              rows={4}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Beskriv hvorfor sagen flyttes til denne gruppe…"
            />
          </div>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1 size-4 rounded border"
              checked={faultDisplayed}
              onChange={(event) => setFaultDisplayed(event.target.checked)}
            />
            <span>Fejlviseret (fejlen er identificeret og kommunikeret)</span>
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Annuller
          </Button>
          <Button
            type="button"
            className="bg-star-blue hover:bg-star-navy"
            disabled={!reason.trim()}
            onClick={() => onConfirm({ reason: reason.trim(), faultDisplayed })}
          >
            Gem tildeling
          </Button>
        </div>
      </div>
    </div>
  );
}
