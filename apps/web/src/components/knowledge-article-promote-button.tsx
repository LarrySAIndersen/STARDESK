"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { apiPost } from "@/lib/api";
import type { KnowledgeArticle } from "@/types/knowledge-article";
import type { TicketDetail } from "@/types/ticket";

export function KnowledgeArticlePromoteButton({ ticket }: { ticket: TicketDetail }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (ticket.is_knowledge_article) {
    return (
      <p className="text-[var(--gray-mid)] text-xs">
        Vidensartikel — {ticket.knowledge_status_label_da ?? "—"} (
        {ticket.knowledge_visibility_label_da ?? "—"})
        {" · "}
        <a href={`/knowledge/${ticket.id}`} className="text-star-blue underline">
          Rediger artikel
        </a>
      </p>
    );
  }

  async function promote(publish: boolean) {
    setBusy(true);
    setError(null);
    try {
      const article = await apiPost<KnowledgeArticle>(
        `/api/v1/knowledge-articles/promote/${ticket.id}`,
        {
          knowledge_status: publish ? "published" : "draft",
          knowledge_visibility: "external",
        },
      );
      router.push(`/knowledge/${article.id}`);
      router.refresh();
    } catch {
      setError("Kunne ikke oprette vidensartikel.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        className="border-star-navy/30 text-star-navy hover:bg-star-blue-light rounded-sm text-xs"
        disabled={busy}
        onClick={() => promote(false)}
      >
        {busy ? "Opretter…" : "Opret vidensartikel (kladde)"}
      </Button>
      <Button
        type="button"
        className="bg-star-navy hover:bg-star-blue rounded-sm text-xs"
        disabled={busy}
        onClick={() => promote(true)}
      >
        Udgiv på portal
      </Button>
      {error ? (
        <p className="text-star-red text-xs" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
