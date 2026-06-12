"use client";

import { Video, X } from "lucide-react";

import { Button } from "@/components/ui/button";

const MOCK_PARTICIPANTS = [
  { initials: "AK", name: "Anna K." },
  { initials: "LK", name: "Lars K." },
  { initials: "DU", name: "Dig" },
];

export function ChatHuddleMock({
  open,
  onClose,
  channelName,
}: {
  open: boolean;
  onClose: () => void;
  channelName: string;
}) {
  if (!open) return null;

  return (
    <div className="team-chat-huddle-backdrop" role="presentation" onClick={onClose}>
      <div
        className="team-chat-huddle-dialog"
        role="dialog"
        aria-label={`Huddle i ${channelName}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mb-3 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-bold text-star-navy">
            <Video className="size-4" aria-hidden />
            Huddle — #{channelName}
          </h2>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground rounded p-1"
            onClick={onClose}
            aria-label="Luk huddle"
          >
            <X className="size-4" />
          </button>
        </header>
        <p className="text-muted-foreground mb-3 text-xs">
          Video-mockup — rigtig WebRTC-integration kommer senere.
        </p>
        <div className="team-chat-huddle-grid">
          {MOCK_PARTICIPANTS.map((p) => (
            <div key={p.initials} className="team-chat-huddle-tile">
              <span className="team-chat-huddle-avatar">{p.initials}</span>
              <span className="text-[11px] font-medium">{p.name}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" disabled>
            Slå kamera til
          </Button>
          <Button type="button" size="sm" variant="outline" disabled>
            Slå mikrofon fra
          </Button>
          <Button type="button" size="sm" variant="destructive" onClick={onClose}>
            Forlad huddle
          </Button>
        </div>
      </div>
    </div>
  );
}
