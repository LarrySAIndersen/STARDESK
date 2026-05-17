"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useId, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFocusTrap } from "@/hooks/use-focus-trap";
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
  onConfirm,
  onCancel,
}: {
  ticketTitle: string;
  teamName?: string;
  teamId?: string;
  teams?: Team[];
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
  const dialogTitle = resolvedTeamName
    ? `Tildel til ${resolvedTeamName}`
    : "Tildel sag til gruppe";

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
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
        className="bg-background w-full max-w-md rounded-lg border p-6 shadow-lg"
      >
        <h2 id={titleId} className="text-star-navy text-lg font-semibold">
          {dialogTitle}
        </h2>
        <p id={descId} className="text-muted-foreground mt-1 text-sm">
          {ticketTitle}
        </p>

        <form className="mt-4 space-y-4" onSubmit={onSubmit} noValidate>
          {needsTeamPick ? (
            <div className="space-y-2">
              <Label htmlFor={teamSelectId}>Gruppe</Label>
              <select
                id={teamSelectId}
                className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-lg border bg-transparent px-2.5 text-sm outline-none focus-visible:ring-3"
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
                <p className="text-destructive text-xs" role="alert">
                  {errors.teamId.message}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="assignment-reason">
              Årsag / bemærkning <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="assignment-reason"
              rows={4}
              placeholder="Beskriv hvorfor sagen flyttes til denne gruppe…"
              aria-required="true"
              aria-invalid={reasonInvalid}
              aria-describedby={reasonHintId}
              {...register("reason")}
            />
            {errors.reason ? (
              <p id={reasonHintId} className="text-destructive text-xs" role="alert">
                {errors.reason.message}
              </p>
            ) : (
              <p id={reasonHintId} className="text-muted-foreground text-xs">
                Forklar kort hvorfor sagen flyttes.
              </p>
            )}
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

          <div className="mt-6 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Annuller
            </Button>
            <Button
              type="submit"
              className="bg-star-blue hover:bg-star-navy"
              disabled={!canSubmit}
            >
              Gem tildeling
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
