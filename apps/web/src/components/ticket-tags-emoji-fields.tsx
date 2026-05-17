"use client";

import { Label } from "@/components/ui/label";
import { TICKET_EMOJI_OPTIONS } from "@/lib/ticket-emojis";
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
  return (
    <div className="border-input bg-background space-y-4 rounded-md border p-4">
      <div className="space-y-2">
        <Label htmlFor={tagsInputId}>Tags (søgbare)</Label>
        <input
          id={tagsInputId}
          type="text"
          disabled={disabled}
          value={tagsValue}
          onChange={(event) => onTagsChange(event.target.value)}
          placeholder="fx adgang, printer, vpn — adskil med komma"
          className="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
        />
        <p className="text-muted-foreground text-xs">
          Op til 10 tags. Bruges til søgning i sagsoversigten.
        </p>
      </div>

      <fieldset className="space-y-2" disabled={disabled}>
        <legend className="text-star-navy text-sm font-medium">Emoji på sagen</legend>
        <p className="text-muted-foreground text-xs">Vælg ét ikon — valgfrit</p>
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-10" role="radiogroup" aria-label="Vælg emoji">
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
                  "flex flex-col items-center gap-0.5 rounded-md border p-2 text-xl transition-colors",
                  selected
                    ? "border-star-blue bg-white ring-2 ring-star-blue"
                    : "border-border bg-white/80 hover:border-star-blue",
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
