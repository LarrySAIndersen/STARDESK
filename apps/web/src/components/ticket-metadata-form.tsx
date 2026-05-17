"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { apiGet, apiPatch } from "@/lib/api";
import type { SubCause } from "@/types/sub-cause";
import type { TicketDetail } from "@/types/ticket";

export function TicketMetadataForm({
  ticket,
}: {
  ticket: TicketDetail;
}) {
  const router = useRouter();
  const [isMajor, setIsMajor] = useState(ticket.is_major);
  const [subCauses, setSubCauses] = useState<SubCause[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>(
    ticket.sub_causes.map((sc) => sc.id),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ticket.category_id) {
      setSubCauses([]);
      return;
    }
    apiGet<SubCause[]>(`/api/v1/sub-causes?category_id=${ticket.category_id}`)
      .then(setSubCauses)
      .catch(() => setSubCauses([]));
  }, [ticket.category_id]);

  function toggleSubCause(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  async function handleSave() {
    setIsSubmitting(true);
    setError(null);
    try {
      await apiPatch<TicketDetail>(`/api/v1/tickets/${ticket.id}/metadata`, {
        is_major: isMajor,
        sub_cause_ids: selectedIds,
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke gemme");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-3 border-t pt-4">
      <p className="text-sm font-medium">Underårsager og stor sag</p>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 rounded border"
          checked={isMajor}
          onChange={(e) => setIsMajor(e.target.checked)}
        />
        <span>Stor sag</span>
      </label>
      {subCauses.length > 0 ? (
        <ul className="border-input max-h-32 space-y-2 overflow-y-auto rounded-md border p-2 text-sm">
          {subCauses.map((sc) => (
            <li key={sc.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                id={`meta-sc-${sc.id}`}
                checked={selectedIds.includes(sc.id)}
                onChange={() => toggleSubCause(sc.id)}
                className="size-4 rounded border"
              />
              <label htmlFor={`meta-sc-${sc.id}`}>{sc.name_da}</label>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-xs">Ingen underårsager for kategorien.</p>
      )}
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
      <Button type="button" size="sm" className="w-full" disabled={isSubmitting} onClick={handleSave}>
        {isSubmitting ? "Gemmer…" : "Gem underårsager"}
      </Button>
    </div>
  );
}
