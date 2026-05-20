"use client";

import { useMemo } from "react";

import { CommentReactionBar } from "@/components/comment-reaction-bar";
import { formatDateTimeDa } from "@/lib/utils";
import type { Comment } from "@/types/comment";

function CommentItem({ comment, ticketId }: { comment: Comment; ticketId: string }) {
  const reactions = comment.reactions ?? {
    positive_count: 0,
    negative_count: 0,
    current_user_sentiment: null,
  };

  return (
    <li className="border-[var(--gray-border)] border-b py-4 last:border-b-0">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-star-navy text-[13px] font-semibold">{comment.author_display_name}</p>
        <time
          className="text-[var(--gray-mid)] text-[11px] tabular-nums"
          dateTime={comment.created_at}
        >
          {formatDateTimeDa(comment.created_at)}
        </time>
      </div>
      <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{comment.body}</p>
      <CommentReactionBar ticketId={ticketId} commentId={comment.id} initial={reactions} />
    </li>
  );
}

/** Portal employee view: only external comments (`is_internal === false`). */
export function CommentThread({
  ticketId,
  comments,
}: {
  ticketId: string;
  comments: Comment[];
}) {
  const visible = useMemo(() => {
    return [...comments]
      .filter((c) => !c.is_internal)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [comments]);

  if (visible.length === 0) {
    return (
      <div className="portal-v2-empty py-10">
        <p className="text-star-navy text-[14px] font-semibold">Ingen beskeder endnu</p>
        <p className="text-[var(--gray-mid)] mt-1 text-[13px]">
          Skriv en opdatering nedenfor — sagsbehandleren svarer her, når der er nyheder.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-[var(--gray-border)]">
      {visible.map((comment) => (
        <CommentItem key={comment.id} comment={comment} ticketId={ticketId} />
      ))}
    </ul>
  );
}
