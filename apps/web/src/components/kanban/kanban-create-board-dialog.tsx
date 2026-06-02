"use client";

import { GripVertical, Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";

import {
  AccessibleModalBackdrop,
  AccessibleModalPanel,
} from "@/components/ui/accessible-modal-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { apiPost } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  KANBAN_BOARD_TEMPLATES,
  type KanbanBoardSummary,
  type KanbanBoardTemplate,
} from "@/types/kanban";

function updateCustomColumn(columns: string[], index: number, value: string): string[] {
  return columns.map((col, i) => (i === index ? value : col));
}

function removeCustomColumn(columns: string[], index: number): string[] {
  return columns.filter((_, i) => i !== index);
}

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
  const [template, setTemplate] = useState<KanbanBoardTemplate>("itsm");
  const [customColumns, setCustomColumns] = useState<string[]>(["Backlog", "I gang", "Færdig"]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const trapRef = useFocusTrap(open);

  if (!open) {
    return null;
  }

  function resetForm() {
    setName("");
    setDescription("");
    setTemplate("itsm");
    setCustomColumns(["Backlog", "I gang", "Færdig"]);
    setError(null);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Angiv et navn.");
      return;
    }
    const columnNames =
      template === "custom"
        ? customColumns.map((c) => c.trim()).filter(Boolean)
        : [];
    if (template === "custom" && columnNames.length === 0) {
      setError("Tilføj mindst én kolonne.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const board = await apiPost<KanbanBoardSummary>("/api/v1/kanban/boards", {
        name: trimmed,
        description: description.trim() || null,
        template,
        column_names: columnNames,
      });
      resetForm();
      onCreated(board.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke oprette board.");
    } finally {
      setSaving(false);
    }
  }

  const selectedTemplate = KANBAN_BOARD_TEMPLATES.find((t) => t.id === template);

  return (
    <AccessibleModalBackdrop onClose={handleClose}>
      <AccessibleModalPanel
        trapRef={trapRef}
        titleId={titleId}
        onClose={handleClose}
        className="ledger-card max-h-[90vh] w-full max-w-lg overflow-y-auto p-5"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <h2 id={titleId} className="text-lg font-semibold">
              Nyt Kanban-board
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Vælg en skabelon, tilpas kolonner og begynd at organisere sager visuelt.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="kanban-board-name">Navn</Label>
            <Input
              id="kanban-board-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Fx Service Desk — Uge 21"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="kanban-board-desc">Beskrivelse (valgfri)</Label>
            <Textarea
              id="kanban-board-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Hvad bruges boardet til?"
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Board-type</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {KANBAN_BOARD_TEMPLATES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setTemplate(option.id)}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors",
                    template === option.id
                      ? "border-star-blue bg-star-blue/5 ring-1 ring-star-blue/30"
                      : "border-[var(--gray-border)] hover:border-star-blue/30 hover:bg-muted/40",
                  )}
                >
                  <span className="block text-sm font-semibold">{option.label}</span>
                  <span className="text-muted-foreground mt-0.5 block text-xs leading-snug">
                    {option.description}
                  </span>
                  {option.columns.length > 0 ? (
                    <span className="text-muted-foreground mt-2 block text-[10px]">
                      {option.columns.join(" → ")}
                    </span>
                  ) : (
                    <span className="text-muted-foreground mt-2 block text-[10px]">
                      Ingen foruddefinerede kolonner
                    </span>
                  )}
                </button>
              ))}
            </div>
          </fieldset>

          {template === "custom" ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Kolonner</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setCustomColumns((cols) => [...cols, ""])}
                  disabled={customColumns.length >= 12}
                >
                  <Plus className="mr-1 size-3" />
                  Tilføj kolonne
                </Button>
              </div>
              <ul className="space-y-2">
                {customColumns.map((col, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <GripVertical className="text-muted-foreground size-4 shrink-0" aria-hidden />
                    <Input
                      value={col}
                      onChange={(e) =>
                        setCustomColumns((cols) =>
                          updateCustomColumn(cols, index, e.target.value),
                        )
                      }
                      placeholder={`Kolonne ${index + 1}`}
                      maxLength={64}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label={`Fjern kolonne ${index + 1}`}
                      disabled={customColumns.length <= 1}
                      onClick={() =>
                        setCustomColumns((cols) => removeCustomColumn(cols, index))
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : selectedTemplate && selectedTemplate.columns.length > 0 ? (
            <div className="rounded-md border border-dashed border-[var(--gray-border)] bg-muted/30 px-3 py-2">
              <p className="text-muted-foreground text-xs">
                Kolonner:{" "}
                <span className="text-foreground font-medium">
                  {selectedTemplate.columns.join(" · ")}
                </span>
              </p>
            </div>
          ) : null}

          {error ? <p className="text-destructive text-sm">{error}</p> : null}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={handleClose} disabled={saving}>
              Annuller
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Opretter…" : "Opret board"}
            </Button>
          </div>
        </form>
      </AccessibleModalPanel>
    </AccessibleModalBackdrop>
  );
}
