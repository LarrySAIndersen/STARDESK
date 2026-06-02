"use client";

import { useId, useState } from "react";

import {
  AccessibleModalBackdrop,
  AccessibleModalPanel,
} from "@/components/ui/accessible-modal-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFocusTrap } from "@/hooks/use-focus-trap";

export function KanbanAddColumnDialog({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (name: string) => Promise<void>;
}) {
  const titleId = useId();
  const [name, setName] = useState("");
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
      setError("Angiv et kolonnenavn.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onAdd(trimmed);
      setName("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke oprette kolonne.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AccessibleModalBackdrop onClose={onClose}>
      <AccessibleModalPanel
        trapRef={trapRef}
        titleId={titleId}
        onClose={onClose}
        className="ledger-card w-full max-w-md space-y-4 p-5"
      >
        <form onSubmit={handleSubmit}>
          <h2 id={titleId} className="text-lg font-semibold">
            Ny kolonne
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Kolonnen tilføjes til højre på boardet. Du kan omdøbe den bagefter.
          </p>
          <div className="mt-4 space-y-2">
            <Label htmlFor="kanban-column-name">Kolonnenavn</Label>
            <Input
              id="kanban-column-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Fx Afventer godkendelse"
              autoFocus
              maxLength={64}
            />
          </div>
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Annuller
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Opretter…" : "Tilføj kolonne"}
            </Button>
          </div>
        </form>
      </AccessibleModalPanel>
    </AccessibleModalBackdrop>
  );
}
