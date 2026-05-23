"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { apiPost } from "@/lib/api";
import type { KanbanBoardSummary } from "@/types/kanban";

export function KanbanCreateBoardDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (boardId: string) => void;
}) {
  const titleId = useId();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const trapRef = useFocusTrap(open);

  if (!open) {
    return null;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Angiv et navn.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const board = await apiPost<KanbanBoardSummary>("/api/v1/kanban/boards", {
        name: trimmed,
        description: description.trim() || null,
      });
      setName("");
      setDescription("");
      onCreated(board.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke oprette board.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        ref={trapRef}
        role="dialog"
        aria-labelledby={titleId}
        className="ledger-card w-full max-w-md space-y-4 p-5"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
      >
        <form onSubmit={handleSubmit}>
        <h2 id={titleId} className="text-lg font-semibold">
          Nyt Kanban-board
        </h2>
        <div className="space-y-2">
          <Label htmlFor="kanban-board-name">Navn</Label>
          <Input
            id="kanban-board-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Fx Service Desk"
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="kanban-board-desc">Beskrivelse (valgfri)</Label>
          <Textarea
            id="kanban-board-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Annuller
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Opretter…" : "Opret board"}
          </Button>
        </div>
        </form>
      </div>
    </div>
  );
}
