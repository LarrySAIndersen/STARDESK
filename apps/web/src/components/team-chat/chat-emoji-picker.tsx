"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Smile } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ALL_EMOJIS, EMOJI_CATEGORIES } from "@/lib/team-chat-emojis";
import { cn } from "@/lib/utils";

export function ChatEmojiPicker({
  onPick,
  className,
}: {
  onPick: (emoji: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<string>("Ofte brugt");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const handlePick = useCallback(
    (emoji: string) => {
      onPick(emoji);
      setOpen(false);
    },
    [onPick],
  );

  const emojis = EMOJI_CATEGORIES[tab] ?? ALL_EMOJIS;

  return (
    <div ref={ref} className={cn("relative", className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0"
        aria-label="Indsæt emoji"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Smile className="size-4" aria-hidden />
      </Button>
      {open ? (
        <div
          className="team-chat-emoji-popover"
          role="dialog"
          aria-label="Vælg emoji"
        >
          <div className="team-chat-emoji-tabs">
            {Object.keys(EMOJI_CATEGORIES).map((cat) => (
              <button
                key={cat}
                type="button"
                className={cn(
                  "team-chat-emoji-tab",
                  tab === cat && "team-chat-emoji-tab--active",
                )}
                onClick={() => setTab(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="team-chat-emoji-grid">
            {emojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="team-chat-emoji-btn"
                onClick={() => handlePick(emoji)}
                aria-label={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
