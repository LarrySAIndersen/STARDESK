"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { CommentReactionBar } from "@/components/comment-reaction-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Comment } from "@/types/comment";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("da-DK", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

function CommentRow({
  comment,
  ticketId,
  staffView,
  defaultOpen,
}: {
  comment: Comment;
  ticketId: string;
  staffView: boolean;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const reactions = comment.reactions ?? {
    positive_count: 0,
    negative_count: 0,
    current_user_sentiment: null,
  };

  return (
    <li className="border-[var(--gray-border)] border-b py-2 last:border-b-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-star-navy text-xs font-semibold">{comment.author_display_name}</p>
          <p className="text-muted-foreground text-[11px]">{formatDate(comment.created_at)}</p>
          {staffView ? (
            <Badge
              variant={comment.is_internal ? "secondary" : "outline"}
              className="mt-1 h-5 px-1.5 text-[10px]"
            >
              {comment.visibility_label_da}
            </Badge>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground h-7 shrink-0 px-2 text-[11px]"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
        >
          {open ? "Skjul" : "Vis"}
        </Button>
      </div>
      {open ? (
        <>
          <p className="text-star-navy mt-1.5 text-xs leading-relaxed whitespace-pre-wrap">
            {comment.body}
          </p>
          <CommentReactionBar ticketId={ticketId} commentId={comment.id} initial={reactions} />
        </>
      ) : (
        <p className="text-muted-foreground mt-1 truncate text-xs">{comment.body}</p>
      )}
    </li>
  );
}

export function TicketTopBandComments({
  ticketId,
  comments,
  staffView,
  className,
}: {
  ticketId: string;
  comments: Comment[];
  staffView: boolean;
  className?: string;
}) {
  const visible = useMemo(() => {
    const list = staffView ? comments : comments.filter((c) => !c.is_internal);
    return [...list].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  }, [comments, staffView]);

  return (
    <div className={cn("min-h-0", className)}>
      <p className="wire-form-label">Kommentarer</p>
      {visible.length === 0 ? (
        <p className="text-muted-foreground mt-1 text-xs">Ingen kommentarer endnu.</p>
      ) : (
        <ul className="mt-1 max-h-[min(11rem,26vh)] overflow-y-auto pr-0.5">
          {visible.map((comment, index) => (
            <CommentRow
              key={comment.id}
              comment={comment}
              ticketId={ticketId}
              staffView={staffView}
              defaultOpen={index >= visible.length - 2}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

export function CollapsibleCommentComposer({ commentForm }: { commentForm: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-[var(--gray-border)] mt-3 shrink-0 border-t pt-3">
      <button
        type="button"
        className="text-star-navy hover:text-star-blue flex w-full items-center justify-between gap-2 text-left text-xs font-semibold"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>Tilføj kommentar</span>
        <ChevronDown
          className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open ? <div className="mt-3">{commentForm}</div> : null}
    </div>
  );
}
