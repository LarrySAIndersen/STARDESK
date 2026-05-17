"use client";

import { useMemo, useState } from "react";

import { CommentReactionBar } from "@/components/comment-reaction-bar";
import { CommentForm } from "@/components/comment-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Comment } from "@/types/comment";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("da-DK", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

function defaultExpanded(index: number, total: number): boolean {
  return index >= total - 3;
}

function CommentItem({
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
    <li className="rounded-md border border-star-blue/15 bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{comment.author_display_name}</p>
          <p className="text-muted-foreground text-xs">{formatDate(comment.created_at)}</p>
          {staffView ? (
            <Badge
              variant={comment.is_internal ? "secondary" : "outline"}
              className="mt-1"
            >
              {comment.visibility_label_da}
            </Badge>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 text-xs"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
        >
          {open ? "Skjul" : "Vis"}
        </Button>
      </div>
      {open ? (
        <>
          <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">{comment.body}</p>
          <CommentReactionBar ticketId={ticketId} commentId={comment.id} initial={reactions} />
        </>
      ) : (
        <p className="text-muted-foreground mt-2 truncate text-sm">{comment.body}</p>
      )}
    </li>
  );
}

export function TicketComments({
  ticketId,
  comments,
  staffView,
  embedded = false,
}: {
  ticketId: string;
  comments: Comment[];
  staffView: boolean;
  embedded?: boolean;
}) {
  const visible = useMemo(() => {
    const list = staffView ? comments : comments.filter((c) => !c.is_internal);
    return [...list].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  }, [comments, staffView]);

  const list =
    visible.length === 0 ? null : (
      <ul className="space-y-3">
        {visible.map((comment, index) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            ticketId={ticketId}
            staffView={staffView}
            defaultOpen={defaultExpanded(index, visible.length)}
          />
        ))}
      </ul>
    );

  if (embedded) {
    return list;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Kommentarer og noter</CardTitle>
          <CardDescription>
            Kronologisk oversigt — navn og tidspunkt er altid synlige. Klik Vis/Skjul for
            indhold. Brug 👍 og 👎 på hver kommentar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {list ?? <p className="text-muted-foreground text-sm">Ingen kommentarer endnu.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{staffView ? "Ny kommentar" : "Skriv til sagsbehandling"}</CardTitle>
        </CardHeader>
        <CardContent>
          <CommentForm ticketId={ticketId} staffMode={staffView} />
        </CardContent>
      </Card>
    </div>
  );
}
