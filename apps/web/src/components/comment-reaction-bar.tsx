"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { apiPut } from "@/lib/api";
import type { CommentReactionSummary } from "@/types/comment";

export function CommentReactionBar({
  ticketId,
  commentId,
  initial,
}: {
  ticketId: string;
  commentId: string;
  initial: CommentReactionSummary;
}) {
  const [summary, setSummary] = useState(initial);
  const [pending, setPending] = useState<"positive" | "negative" | null>(null);

  async function toggle(sentiment: "positive" | "negative") {
    setPending(sentiment);
    try {
      const next = await apiPut<CommentReactionSummary>(
        `/api/v1/tickets/${ticketId}/comments/${commentId}/reactions`,
        { sentiment },
      );
      setSummary(next);
    } finally {
      setPending(null);
    }
  }

  const positiveActive = summary.current_user_sentiment === "positive";
  const negativeActive = summary.current_user_sentiment === "negative";

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label="Reaktioner">
      <Button
        type="button"
        variant={positiveActive ? "default" : "outline"}
        size="sm"
        className={positiveActive ? "bg-star-blue hover:bg-star-navy h-8 gap-1" : "h-8 gap-1"}
        disabled={pending !== null}
        onClick={() => void toggle("positive")}
        aria-pressed={positiveActive}
      >
        <span aria-hidden>👍</span>
        <span className="text-xs">{summary.positive_count}</span>
        <span className="sr-only">Positiv</span>
      </Button>
      <Button
        type="button"
        variant={negativeActive ? "destructive" : "outline"}
        size="sm"
        className="h-8 gap-1"
        disabled={pending !== null}
        onClick={() => void toggle("negative")}
        aria-pressed={negativeActive}
      >
        <span aria-hidden>👎</span>
        <span className="text-xs">{summary.negative_count}</span>
        <span className="sr-only">Negativ</span>
      </Button>
    </div>
  );
}
