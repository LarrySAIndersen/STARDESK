"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiPost } from "@/lib/api";
import type { Comment, CommentVisibility } from "@/types/comment";

export function CommentForm({
  ticketId,
  staffMode = false,
  primaryNavy = false,
}: {
  ticketId: string;
  /** Agent/admin: choose internal vs external (customer portal). */
  staffMode?: boolean;
  primaryNavy?: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<CommentVisibility>("external");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim()) {
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await apiPost<Comment>(`/api/v1/tickets/${ticketId}/comments`, {
        body,
        visibility: staffMode ? visibility : "external",
        is_internal: staffMode ? visibility === "internal" : false,
      });
      setBody("");
      setVisibility("external");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke gemme kommentar");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {staffMode ? (
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

      <div className="space-y-2">
        <Label htmlFor="comment-body">
          {staffMode
            ? visibility === "internal"
              ? "Intern note"
              : "Ekstern opdatering"
            : "Din besked"}
        </Label>
        <Textarea
          id="comment-body"
          rows={4}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={
            staffMode
              ? visibility === "internal"
                ? "Intern note til kolleger…"
                : "Besked til indmelder (vises i kundeportalen)…"
              : "Skriv en opdatering…"
          }
        />
      </div>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <Button
        type="submit"
        disabled={isSubmitting || !body.trim()}
        className={primaryNavy ? "bg-star-navy hover:bg-star-blue w-full rounded-sm" : undefined}
      >
        {isSubmitting ? "Gemmer…" : staffMode ? "Gem opdatering" : "Tilføj besked"}
      </Button>
    </form>
  );
}
