"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { TicketTagsEmojiFields } from "@/components/ticket-tags-emoji-fields";
import { Button } from "@/components/ui/button";
import { formatTagsForInput, parseTagsInput } from "@/lib/ticket-tags";
import { apiGet, apiPatch } from "@/lib/api";
import type { SubCause } from "@/types/sub-cause";
import type { TicketDetail } from "@/types/ticket";

export function TicketMetadataForm({
  ticket,
  staff = false,
}: {
  ticket: TicketDetail;
  staff?: boolean;
}) {
  const router = useRouter();
  const [isMajor, setIsMajor] = useState(ticket.is_major);
  const [isShared, setIsShared] = useState(Boolean(ticket.is_shared));
  const [isSecurityTicket, setIsSecurityTicket] = useState(
    Boolean(ticket.is_security_ticket),
  );
  const [subCauses, setSubCauses] = useState<SubCause[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>(
    ticket.sub_causes.map((sc) => sc.id),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tagsInput, setTagsInput] = useState(formatTagsForInput(ticket.tags));
  const [emoji, setEmoji] = useState<string | null>(ticket.emoji ?? null);

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
      const payload: Record<string, unknown> = {
        is_major: isMajor,
        sub_cause_ids: selectedIds,
        tags: parseTagsInput(tagsInput),
        emoji,
      };
      if (staff) {
        payload.is_security_ticket = isSecurityTicket;
        payload.is_shared = isShared;
      }
      await apiPatch<TicketDetail>(`/api/v1/tickets/${ticket.id}/metadata`, payload);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke gemme");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-3 border-t pt-4">
      <p className="text-sm font-medium">Tags, emoji og underårsager</p>
      <TicketTagsEmojiFields
        tagsValue={tagsInput}
        onTagsChange={setTagsInput}
        emojiValue={emoji}
        onEmojiChange={setEmoji}
        disabled={isSubmitting}
        tagsInputId={`meta-tags-${ticket.id}`}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 rounded border"
          checked={isMajor}
          onChange={(e) => setIsMajor(e.target.checked)}
        />
        <span>Stor sag</span>
      </label>
      {staff ? (
        <>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 rounded border"
              checked={isShared}
              onChange={(e) => setIsShared(e.target.checked)}
            />
            <span>Delt sag (synlig for slutbrugere)</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 rounded border"
              checked={isSecurityTicket}
              onChange={(e) => setIsSecurityTicket(e.target.checked)}
            />
            <span>Sikkerhedssag</span>
          </label>
        </>
      ) : null}
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
