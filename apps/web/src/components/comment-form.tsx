"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  PendingImageAttachments,
  usePendingImageAttachments,
} from "@/components/pending-image-attachments";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiPost } from "@/lib/api";
import { uploadTicketAttachments } from "@/lib/upload-ticket-attachments";
import type { Comment, CommentVisibility } from "@/types/comment";

const IMAGE_ONLY_COMMENT_BODY = "(Vedhæftede billeder)";

export function CommentForm({
  ticketId,
  staffMode = false,
  primaryNavy = false,
  canBroadcastToChildren = false,
  childCount = 0,
  hidePendingPreview = false,
  compact = false,
  onPaste: onPasteProp,
  externalPending,
  onSubmitted,
}: {
  ticketId: string;
  /** Agent/admin: choose internal vs external (customer portal). */
  staffMode?: boolean;
  primaryNavy?: boolean;
  /** Store sag with undersager: optional broadcast of the same comment. */
  canBroadcastToChildren?: boolean;
  childCount?: number;
  /** Image previews rendered elsewhere (e.g. top-band strip). */
  hidePendingPreview?: boolean;
  compact?: boolean;
  onPaste?: (event: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  externalPending?: {
    files: File[];
    hasFiles: boolean;
    clear: () => void;
  };
  onSubmitted?: () => void;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<CommentVisibility>("external");
  const [broadcastToChildren, setBroadcastToChildren] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const showBroadcast = canBroadcastToChildren && childCount > 0;
  const internalPending = usePendingImageAttachments();
  const pendingImages = externalPending?.files ?? internalPending.files;
  const hasFiles = externalPending?.hasFiles ?? internalPending.hasFiles;
  const clear = externalPending?.clear ?? internalPending.clear;
  const onPaste = onPasteProp ?? internalPending.onPaste;

  const canSubmit = body.trim().length > 0 || hasFiles;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const commentBody = body.trim() || IMAGE_ONLY_COMMENT_BODY;
      await apiPost<Comment>(`/api/v1/tickets/${ticketId}/comments`, {
        body: commentBody,
        visibility: staffMode ? visibility : "external",
        is_internal: staffMode ? visibility === "internal" : false,
        broadcast_to_children: showBroadcast && broadcastToChildren,
      });
      if (pendingImages.length > 0) {
        await uploadTicketAttachments(ticketId, pendingImages);
      }
      setBody("");
      setVisibility("external");
      setBroadcastToChildren(false);
      clear();
      onSubmitted?.();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke gemme kommentar");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={compact ? "space-y-3" : "space-y-4"}>
      {staffMode && !compact ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Opdateringstype</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <label
              className={`border-input flex cursor-pointer gap-3 rounded-md border p-3 text-sm ${
                visibility === "external"
                  ? "border-star-blue ring-star-blue/30 ring-2"
                  : ""
              }`}
            >
              <input
                type="radio"
                name="visibility"
                value="external"
                checked={visibility === "external"}
                onChange={() => setVisibility("external")}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium">Ekstern</span>
                <span className="text-muted-foreground mt-0.5 block text-xs">
                  Synlig i kundeportalen for indmelder og organisationen.
                </span>
              </span>
            </label>
            <label
              className={`border-input flex cursor-pointer gap-3 rounded-md border p-3 text-sm ${
                visibility === "internal"
                  ? "border-star-blue ring-star-blue/30 ring-2"
                  : ""
              }`}
            >
              <input
                type="radio"
                name="visibility"
                value="internal"
                checked={visibility === "internal"}
                onChange={() => setVisibility("internal")}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium">Intern</span>
                <span className="text-muted-foreground mt-0.5 block text-xs">
                  Kun synlig for agenter og administratorer.
                </span>
              </span>
            </label>
          </div>
        </fieldset>
      ) : null}

      {staffMode && compact ? (
        <fieldset className="flex flex-wrap gap-3 text-xs">
          <legend className="sr-only">Opdateringstype</legend>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input
              type="radio"
              name="visibility"
              value="external"
              checked={visibility === "external"}
              onChange={() => setVisibility("external")}
            />
            Ekstern
          </label>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input
              type="radio"
              name="visibility"
              value="internal"
              checked={visibility === "internal"}
              onChange={() => setVisibility("internal")}
            />
            Intern
          </label>
        </fieldset>
      ) : null}

      <div className="space-y-2">
        {!compact ? (
          <Label htmlFor="comment-body">
            {staffMode
              ? visibility === "internal"
                ? "Intern note"
                : "Ekstern opdatering"
              : "Din besked"}
          </Label>
        ) : null}
        <Textarea
          id="comment-body"
          rows={compact ? 3 : 4}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onPaste={onPaste}
          placeholder={
            staffMode
              ? visibility === "internal"
                ? "Intern note til kolleger…"
                : "Besked til indmelder (vises i kundeportalen)…"
              : "Skriv en opdatering…"
          }
        />
        {hidePendingPreview ? null : (
          <PendingImageAttachments files={pendingImages} onRemove={internalPending.removeAt} />
        )}
      </div>

      {showBroadcast ? (
        <div className="flex items-start gap-3 rounded-md border border-star-blue/20 bg-star-blue/5 p-3">
          <input
            id="broadcast-to-children"
            type="checkbox"
            checked={broadcastToChildren}
            onChange={(event) => setBroadcastToChildren(event.target.checked)}
            className="border-input mt-1 size-4 shrink-0 rounded border"
          />
          <div className="space-y-1">
            <Label htmlFor="broadcast-to-children" className="cursor-pointer font-medium">
              Send besked til alle undersager
            </Label>
            <p className="text-muted-foreground text-xs">
              Samme opdatering kopieres til {childCount}{" "}
              {childCount === 1 ? "undersag" : "undersager"} (kun dem du har adgang til).
            </p>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <Button
        type="submit"
        disabled={isSubmitting || !canSubmit}
        className={primaryNavy ? "bg-star-navy hover:bg-star-blue w-full rounded-sm" : undefined}
      >
        {isSubmitting ? "Gemmer…" : staffMode ? "Gem opdatering" : "Tilføj besked"}
      </Button>
    </form>
  );
}
