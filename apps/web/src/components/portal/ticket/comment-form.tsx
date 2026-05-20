"use client";

import { CommentForm as BaseCommentForm } from "@/components/comment-form";

/** Portal comment form — always external, no internal toggle. */
export function PortalCommentForm({ ticketId }: { ticketId: string }) {
  return (
    <div id="portal-comment-form" className="scroll-mt-6">
      <BaseCommentForm ticketId={ticketId} staffMode={false} primaryNavy />
    </div>
  );
}
