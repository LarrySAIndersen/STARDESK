"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { apiPost } from "@/lib/api";

export function KanbanQuickCreateDialog({
  open,
  boardId,
  columnId,
  onClose,
  onCreated,
}: {
  open: boolean;
  boardId: string;
  columnId: string | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const titleId = useId();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const trapRef = useFocusTrap(open);

  if (!open || !columnId) {
    return null;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedDesc = description.trim();
    if (trimmedTitle.length < 3) {
      setError("Titel skal være mindst 3 tegn.");
      return;
    }
    if (trimmedDesc.length < 10) {
      setError("Beskrivelse skal være mindst 10 tegn.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiPost(`/api/v1/kanban/boards/${boardId}/cards`, {
        column_id: columnId,
        ticket: {
          title: trimmedTitle,
          description: trimmedDesc,
          ticket_type: "incident",
          priority: "medium",
        },
      });
      setTitle("");
      setDescription("");
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke oprette sag.");
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
            Ny sag
          </h2>
          <div className="mt-4 space-y-2">
            <Label htmlFor="kanban-quick-title">Titel</Label>
            <Input
              id="kanban-quick-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Kort beskrivelse af problemet"
              autoFocus
            />
          </div>
          <div className="mt-4 space-y-2">
            <Label htmlFor="kanban-quick-desc">Beskrivelse</Label>
            <Textarea
              id="kanban-quick-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Uddyb hvad der skal løses…"
            />
          </div>
          {error ? <p className="text-destructive mt-3 text-sm">{error}</p> : null}
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Annuller
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Opretter…" : "Opret sag"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
