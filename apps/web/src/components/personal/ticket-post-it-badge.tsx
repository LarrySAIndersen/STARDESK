"use client";

import { StickyNote } from "lucide-react";

export function TicketPostItBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      className="ticket-post-it-badge"
      title={`${count} seddel${count === 1 ? "" : "er"} på sagen`}
    >
      <StickyNote className="size-3" aria-hidden />
      <span>{count}</span>
    </span>
  );
}
