"use client";

import { Archive } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { apiDelete } from "@/lib/api";

export function KanbanCloseBoardDialog({
  open,
  boardId,
  boardName,
  onClose,
  onClosed,
}: {
  open: boolean;
  boardId: string;
  boardName: string;
  onClose: () => void;
  onClosed: () => void;
}) {
  const titleId = useId();
  const [confirmName, setConfirmName] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const trapRef = useFocusTrap(open);

  if (!open) {
    return null;
  }

  const nameMatches = confirmName.trim() === boardName.trim();
  const canSubmit = acknowledged && nameMatches;

  function handleDismiss() {
    setConfirmName("");
    setAcknowledged(false);
    setError(null);
    onClose();
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    setClosing(true);
    setError(null);
    try {
      await apiDelete(`/api/v1/kanban/boards/${boardId}`);
      setConfirmName("");
      setAcknowledged(false);
      onClosed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke lukke board.");
    } finally {
      setClosing(false);
    }
  }

  return (
    <motionlessDialogBackdrop onClose={handleDismiss}>
      <motionlessDialogPanel
        trapRef={trapRef}
        titleId={titleId}
        onClose={handleDismiss}
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          <div className="flex items-start gap-3">
            <span className="bg-destructive/10 text-destructive flex size-10 shrink-0 items-center justify-center rounded-lg">
              <Archive className="size-5" aria-hidden />
            </span>
            <div>
              <h2 id={titleId} className="text-lg font-semibold">
                Luk board?
              </h2>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                <strong className="text-foreground">{boardName}</strong> fjernes fra din boardliste.
                Sagerne på boardet slettes <em>ikke</em> — de findes stadig i STARdesk.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <label className="flex cursor-pointer items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Jeg forstår, at boardet lukkes og ikke kan gendannes uden administrator.
              </span>
            </label>

            <div className="space-y-2">
              <Label htmlFor="kanban-close-confirm-name">
                Skriv boardnavnet for at bekræfte:{" "}
                <span className="font-semibold">{boardName}</span>
              </Label>
              <Input
                id="kanban-close-confirm-name"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                placeholder={boardName}
                autoComplete="off"
                autoFocus
              />
            </div>
          </div>

          {error ? <p className="text-destructive mt-3 text-sm">{error}</p> : null}

          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleDismiss} disabled={closing}>
              Annuller
            </Button>
            <Button type="submit" variant="destructive" disabled={closing || !canSubmit}>
              {closing ? "Lukker…" : "Luk board"}
            </Button>
          </div>
        </form>
      </motionlessDialogPanel>
    </motionlessDialogBackdrop>
  );
}

function motionlessDialogBackdrop({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      {children}
    </div>
  );
}

function motionlessDialogPanel({
  children,
  trapRef,
  titleId,
  onClose,
  onClick,
}: {
  children: React.ReactNode;
  trapRef: React.RefObject<HTMLDivElement | null>;
  titleId: string;
  onClose: () => void;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      ref={trapRef}
      role="dialog"
      aria-labelledby={titleId}
      aria-modal="true"
      className="ledger-card w-full max-w-md p-5"
      onClick={onClick}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      {children}
    </div>
  );
}
