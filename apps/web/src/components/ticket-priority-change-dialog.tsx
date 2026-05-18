"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useId } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { priorityLabel } from "@/lib/ticket-labels";

const schema = z.object({
  reason: z
    .string()
    .trim()
    .min(10, "Begrundelse skal være mindst 10 tegn."),
});

type PriorityChangeFormValues = z.infer<typeof schema>;

export function TicketPriorityChangeDialog({
  ticketTitle,
  previousPriority,
  newPriority,
  onConfirm,
  onCancel,
}: {
  ticketTitle: string;
  previousPriority: string;
  newPriority: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const descId = useId();
  const reasonHintId = useId();
  const panelRef = useFocusTrap(true, onCancel);

  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
  } = useForm<PriorityChangeFormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: { reason: "" },
  });

  const reasonValue = useWatch({ control, name: "reason" }) ?? "";
  const reasonInvalid = Boolean(errors.reason);
  const canSubmit = reasonValue.trim().length >= 10;

  const onSubmit = handleSubmit((values) => {
    onConfirm(values.reason.trim());
  });

  return (
    <div
      className="wire-confirm-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="wire-confirm-modal"
      >
        <div className="border-b border-[var(--gray-border)] px-4 py-3.5">
          <h2 id={titleId} className="text-star-navy text-sm font-bold">
            Skift prioritet
          </h2>
          <p id={descId} className="text-[var(--gray-mid)] mt-0.5 text-[11px]">
            {ticketTitle} — fra {priorityLabel(previousPriority)} til{" "}
            {priorityLabel(newPriority)}
          </p>
        </div>

        <form className="space-y-4 px-4 py-3.5" onSubmit={onSubmit} noValidate>
          <div className="space-y-2">
            <Label htmlFor="priority-change-reason">
              Begrundelse <span className="text-star-red">*</span>
            </Label>
            <Textarea
              id="priority-change-reason"
              rows={4}
              className="wire-form-input min-h-[5rem]"
              placeholder="Beskriv hvorfor prioriteten ændres…"
              aria-required="true"
              aria-invalid={reasonInvalid}
              aria-describedby={reasonHintId}
              {...register("reason")}
            />
            {errors.reason ? (
              <p id={reasonHintId} className="text-star-red text-xs" role="alert">
                {errors.reason.message}
              </p>
            ) : null}
          </div>

          <div className="flex justify-end gap-2 border-t border-[var(--gray-border)] pt-3">
            <button type="button" className="wire-btn" onClick={onCancel}>
              Annuller
            </button>
            <button type="submit" className="wire-btn wire-btn-primary" disabled={!canSubmit}>
              Bekræft prioritet
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
