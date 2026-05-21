"use client";

import { useMemo } from "react";

import { CommentReactionBar } from "@/components/comment-reaction-bar";
import { Badge } from "@/components/ui/badge";
import { formatDateTimeDa } from "@/lib/utils";
import type { Comment } from "@/types/comment";

function CommentItem({
  comment,
  ticketId,
  staffView,
}: {
  comment: Comment;
  ticketId: string;
  staffView?: boolean;
}) {
  const reactions = comment.reactions ?? {
    positive_count: 0,
    negative_count: 0,
    current_user_sentiment: null,
  };

  return (
    <li className="border-border border-b py-4 last:border-b-0">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="text-foreground text-[13px] font-semibold">{comment.author_display_name}</p>
          {staffView ? (
            <Badge
              variant={comment.is_internal ? "secondary" : "outline"}
              className="text-[10px]"
            >
              {comment.visibility_label_da}
            </Badge>
          ) : null}
        </div>
        <time
          className="text-muted-foreground text-[11px] tabular-nums"
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

/** Portal / unified case view — external only unless `staffView`. */
export function CommentThread({
  ticketId,
  comments,
  staffView = false,
}: {
  ticketId: string;
  comments: Comment[];
  staffView?: boolean;
}) {
  const visible = useMemo(() => {
    const list = staffView ? comments : comments.filter((c) => !c.is_internal);
    return [...list].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  }, [comments, staffView]);

  if (visible.length === 0) {
    return (
      <div className="portal-v2-empty py-10">
        <p className="text-foreground text-[14px] font-semibold">Ingen beskeder endnu</p>
        <p className="text-muted-foreground mt-1 text-[13px]">
          Skriv en opdatering nedenfor — sagsbehandleren svarer her, når der er nyheder.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {visible.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          ticketId={ticketId}
          staffView={staffView}
        />
      ))}
    </ul>
  );
}
