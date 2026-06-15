"use client";

import { useEffect, useState } from "react";

import { TICKET_EMOJI_OPTIONS } from "@/lib/ticket-emojis";
import { fetchTagCatalog, formatCatalogOption, type TagCatalogEntry } from "@/lib/tag-catalog";
import { cn } from "@/lib/utils";

export function TicketTagsEmojiFields({
  tagsValue,
  onTagsChange,
  emojiValue,
  onEmojiChange,
  tagsInputId = "ticket-tags",
  disabled = false,
}: {
  tagsValue: string;
  onTagsChange: (value: string) => void;
  emojiValue: string | null;
  onEmojiChange: (emoji: string | null) => void;
  tagsInputId?: string;
  disabled?: boolean;
}) {
  const [catalog, setCatalog] = useState<TagCatalogEntry[]>([]);
  const datalistId = `${tagsInputId}-catalog`;

  useEffect(() => {
    fetchTagCatalog({ includeUsage: true })
      .then(setCatalog)
      .catch(() => setCatalog([]));
  }, []);

  return (
    <div className="space-y-4 rounded-[2px] border border-[var(--gray-border)] bg-white p-4">
      <div className="space-y-2">
        <label htmlFor={tagsInputId} className="wire-form-label">
          Tags (søgbare)
        </label>
        <input
          id={tagsInputId}
          type="text"
          disabled={disabled}
          value={tagsValue}
          onChange={(event) => onTagsChange(event.target.value)}
          placeholder="fx adgang, printer, vpn — adskil med komma"
          className="wire-form-input h-9"
          list={catalog.length > 0 ? datalistId : undefined}
        />
        {catalog.length > 0 ? (
          <datalist id={datalistId}>
            {catalog.map((entry) => (
              <option key={entry.slug} value={entry.slug}>
                {formatCatalogOption(entry)}
              </option>
            ))}
          </datalist>
        ) : null}
        <p className="text-muted-foreground text-xs">
          Op til 10 tags fra kataloget. Bruges til søgning og lignende sager.
        </p>
      </div>

      <fieldset className="space-y-2" disabled={disabled}>
        <legend className="wire-form-label">Emoji på sagen</legend>
        <p className="text-muted-foreground text-xs">Vælg ét ikon — valgfrit</p>
        <div
          className="grid grid-cols-5 gap-2 sm:grid-cols-10"
          role="radiogroup"
          aria-label="Vælg emoji"
        >
          {TICKET_EMOJI_OPTIONS.map((option) => {
            const selected = emojiValue === option.emoji;
            return (
              <button
                key={option.emoji}
                type="button"
                title={`${option.label} — ${option.hint}`}
                aria-pressed={selected}
                onClick={() => onEmojiChange(selected ? null : option.emoji)}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-[2px] border border-[var(--gray-border)] p-2 text-xl transition-colors",
                  selected
                    ? "border-star-navy bg-star-blue-light ring-2 ring-star-navy/30"
                    : "bg-white hover:border-star-navy",
                )}
              >
                <span aria-hidden>{option.emoji}</span>
                <span className="text-muted-foreground text-[9px] leading-tight">
                  {option.label.split(" ")[0]}
                </span>
              </button>
            );
          })}
        </div>
        {emojiValue ? (
          <button
            type="button"
            className="text-star-blue text-xs font-medium hover:underline"
            onClick={() => onEmojiChange(null)}
          >
            Fjern emoji
          </button>
        ) : null}
      </fieldset>
    </div>
  );
}
