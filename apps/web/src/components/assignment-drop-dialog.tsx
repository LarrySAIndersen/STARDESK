"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useId, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import {
  confidenceColor,
  confidenceVerdict,
  confidenceVerdictClass,
} from "@/lib/wireframe-labels";
import { cn } from "@/lib/utils";
import type { Team } from "@/types/team";

function buildSchema(requireTeamPick: boolean) {
  return z.object({
    reason: z.string().trim().min(1, "Påkrævet felt."),
    faultDisplayed: z.boolean(),
    teamId: requireTeamPick
      ? z.string().min(1, "Vælg gruppe")
      : z.string().optional(),
  });
}

type AssignmentFormValues = z.infer<ReturnType<typeof buildSchema>>;

export function AssignmentDropDialog({
  ticketTitle,
  teamName,
  teamId,
  teams = [],
  confidence,
  routingReasonDa,
  technicianName,
  onConfirm,
  onCancel,
}: {
  ticketTitle: string;
  teamName?: string;
  teamId?: string;
  teams?: Team[];
  confidence?: number;
  routingReasonDa?: string | null;
  technicianName?: string;
  onConfirm: (data: {
    teamId: string;
    reason: string;
    faultDisplayed: boolean;
  }) => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const descId = useId();
  const reasonHintId = useId();
  const teamSelectId = useId();
  const faultId = useId();
  const panelRef = useFocusTrap(true, onCancel);

  const needsTeamPick = !teamId && teams.length > 0;
  const schema = useMemo(() => buildSchema(needsTeamPick), [needsTeamPick]);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<AssignmentFormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      reason: "",
      faultDisplayed: false,
      teamId: teamId ?? "",
    },
  });

  const watchedTeamId = useWatch({ control, name: "teamId" }) ?? "";
  const reasonValue = useWatch({ control, name: "reason" }) ?? "";
  const resolvedTeamId = teamId ?? watchedTeamId ?? "";
  const resolvedTeamName =
    teamName ?? teams.find((t) => t.id === resolvedTeamId)?.name ?? "";
  const dialogTitle = technicianName
    ? `Bekræft tildeling — ${technicianName}`
    : resolvedTeamName
      ? `Tildel til ${resolvedTeamName}`
      : "Tildel sag til gruppe";
  const score = confidence ?? 0;

  const onSubmit = handleSubmit((values) => {
    const targetTeamId = teamId ?? values.teamId;
    if (!targetTeamId) {
      return;
    }
    onConfirm({
      teamId: targetTeamId,
      reason: values.reason.trim(),
      faultDisplayed: values.faultDisplayed,
    });
  });

  const reasonInvalid = Boolean(errors.reason);
  const canSubmit =
    Boolean(resolvedTeamId) &&
    reasonValue.trim().length > 0 &&
    (!needsTeamPick || Boolean(watchedTeamId));

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
            {dialogTitle}
          </h2>
          <p id={descId} className="text-[var(--gray-mid)] mt-0.5 text-[11px]">
            {ticketTitle}
          </p>
        </div>

        {confidence != null ? (
          <div className="border-b border-[var(--gray-border)] px-4 py-3">
            <div className="flex items-center gap-2 border border-[#B0B4EC] border-l-4 border-l-[var(--ai-purple)] bg-[var(--ai-purple-bg)] p-2.5">
              <span className="wire-ai-pill">AI</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#E8E8E4]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${score}%`, background: confidenceColor(score) }}
                />
              </div>
              <span
                className="text-lg font-bold"
                style={{ color: confidenceColor(score) }}
              >
                {score}%
              </span>
              <span
                className={cn(
                  "rounded-[2px] px-1.5 py-px text-[10px] font-bold",
                  confidenceVerdictClass(score) === "cv-good" &&
                    "bg-[#E6F5EC] text-[#1A7A44]",
                  confidenceVerdictClass(score) === "cv-ok" &&
                    "bg-[#FFF3CD] text-[#7A4800]",
                  confidenceVerdictClass(score) === "cv-bad" &&
                    "bg-star-red-light text-star-red",
                )}
              >
                {confidenceVerdict(score)}
              </span>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-[#2A2C7A]">
              {routingReasonDa ??
                "AI vurderer match ud fra emner, kategori og team-regler."}
            </p>
          </div>
        ) : null}

        <form className="space-y-4 px-4 py-3.5" onSubmit={onSubmit} noValidate>
          {needsTeamPick ? (
            <div className="space-y-2">
              <Label htmlFor={teamSelectId}>Gruppe</Label>
              <select
                id={teamSelectId}
                className="wire-form-input h-9"
                {...register("teamId")}
              >
                <option value="">Vælg gruppe…</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              {errors.teamId ? (
                <p className="text-star-red text-xs" role="alert">
                  {errors.teamId.message}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="assignment-reason">
              Årsag / bemærkning <span className="text-star-red">*</span>
            </Label>
            <Textarea
              id="assignment-reason"
              rows={4}
              className="wire-form-input min-h-[5rem]"
              placeholder="Beskriv hvorfor sagen flyttes…"
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

          <div className="flex items-start gap-2 text-sm">
            <input
              id={faultId}
              type="checkbox"
              className="mt-1 size-4 rounded border"
              {...register("faultDisplayed")}
            />
            <Label htmlFor={faultId} className="font-normal leading-snug">
              Fejlviseret (fejlen er identificeret og kommunikeret)
            </Label>
          </div>

          <div className="flex justify-end gap-2 border-t border-[var(--gray-border)] pt-3">
            <button type="button" className="wire-btn" onClick={onCancel}>
              Annuller
            </button>
            <button
              type="submit"
              className="wire-btn wire-btn-primary"
              disabled={!canSubmit}
            >
              Bekræft tildeling
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
