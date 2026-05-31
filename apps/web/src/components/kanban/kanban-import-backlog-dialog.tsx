"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFocusTrap } from "@/hooks/use-focus-trap";

type BacklogIdea = Readonly<{
  title: string;
  description: string;
}>;

function cleanLine(line: string): string {
  return line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, "").trim();
}

function toIdea(line: string): BacklogIdea | null {
  const cleaned = cleanLine(line);
  if (!cleaned) return null;
  if (/^done$/i.test(cleaned)) return null;

  const title = cleaned.length > 120 ? `${cleaned.slice(0, 117).trim()}...` : cleaned;
  const description =
    cleaned.length >= 10 ? cleaned : `${cleaned} (importeret fra backlog-liste)`;
  return { title, description };
}

export function KanbanImportBacklogDialog({
  open,
  onClose,
  onImport,
  defaultText = "",
}: {
  open: boolean;
  onClose: () => void;
  onImport: (ideas: BacklogIdea[]) => Promise<void>;
  defaultText?: string;
}) {
  const titleId = useId();
  const trapRef = useFocusTrap(open);
  const [rawText, setRawText] = useState(defaultText);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!open) {
    return null;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const ideas = rawText
      .split(/\r?\n/)
      .map((line) => toIdea(line))
      .filter((idea): idea is BacklogIdea => Boolean(idea));
    if (ideas.length === 0) {
      setError("Tilføj mindst én backlog-linje.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onImport(ideas);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke importere backlog.");
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
        className="ledger-card w-full max-w-2xl p-5"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.key === "Escape" && onClose()}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold">
              Importér idéer til Backlog
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Indsæt én idé pr. linje. Linjer bliver oprettet som nye sager i kolonnen Backlog.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="kanban-backlog-lines">Backlog-liste</Label>
            <Textarea
              id="kanban-backlog-lines"
              rows={12}
              value={rawText}
              onChange={(event) => setRawText(event.target.value)}
              placeholder="- Feature-idé 1&#10;- Feature-idé 2&#10;- ... "
              autoFocus
            />
          </div>

          {error ? <p className="text-destructive text-sm">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Annuller
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Importerer..." : "Importér til Backlog"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
