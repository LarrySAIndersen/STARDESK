import { Badge } from "@/components/ui/badge";
import { CommentForm } from "@/components/comment-form";
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

function CommentItem({ comment, staffView }: { comment: Comment; staffView: boolean }) {
  return (
    <li className="border-b pb-4 last:border-0">
      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium">{comment.author_display_name}</span>
        <span className="text-muted-foreground">{formatDate(comment.created_at)}</span>
        {staffView ? (
          <Badge variant={comment.is_internal ? "secondary" : "outline"}>
            {comment.visibility_label_da}
          </Badge>
        ) : null}
      </div>
      <p className="text-sm whitespace-pre-wrap">{comment.body}</p>
    </li>
  );
}

export function TicketComments({
  ticketId,
  comments,
  staffView,
}: {
  ticketId: string;
  comments: Comment[];
  staffView: boolean;
}) {
  const externalComments = comments.filter((c) => !c.is_internal);
  const internalComments = staffView ? comments.filter((c) => c.is_internal) : [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>
            {staffView ? "Eksterne opdateringer" : "Opdateringer fra sagsbehandling"}
          </CardTitle>
          <CardDescription>
            {staffView
              ? "Vises i kundeportalen når indmelder åbner sagen."
              : "Beskeder fra STAR og opdateringer på din sag."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {externalComments.length === 0 ? (
            <p className="text-muted-foreground text-sm">Ingen eksterne opdateringer endnu.</p>
          ) : (
            <ul className="space-y-4">
              {externalComments.map((comment) => (
                <CommentItem key={comment.id} comment={comment} staffView={staffView} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {staffView ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Interne noter</CardTitle>
            <CardDescription>
              Kun synlige for agenter og administratorer — vises ikke i kundeportalen.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {internalComments.length === 0 ? (
              <p className="text-muted-foreground text-sm">Ingen interne noter endnu.</p>
            ) : (
              <ul className="space-y-4">
                {internalComments.map((comment) => (
                  <CommentItem key={comment.id} comment={comment} staffView={staffView} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{staffView ? "Ny opdatering" : "Skriv til sagsbehandling"}</CardTitle>
        </CardHeader>
        <CardContent>
          <CommentForm ticketId={ticketId} staffMode={staffView} />
        </CardContent>
      </Card>
    </div>
  );
}
