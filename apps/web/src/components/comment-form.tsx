"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiPost } from "@/lib/api";
import type { Comment } from "@/types/comment";

export function CommentForm({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [isInternal, setIsInternal] = useState(false);
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
        is_internal: isInternal,
      });
      setBody("");
      setIsInternal(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke gemme kommentar");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="comment-body">Ny kommentar</Label>
        <Textarea
          id="comment-body"
          rows={4}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Skriv en opdatering…"
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isInternal}
          onChange={(event) => setIsInternal(event.target.checked)}
        />
        Intern note (kun synlig for agenter)
      </label>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <Button type="submit" disabled={isSubmitting || !body.trim()}>
        {isSubmitting ? "Gemmer…" : "Tilføj kommentar"}
      </Button>
    </form>
  );
}

