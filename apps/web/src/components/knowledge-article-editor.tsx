"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { apiPatch, apiPost } from "@/lib/api";
import type {
  KnowledgeArticle,
  KnowledgeArticleCreatePayload,
  KnowledgeArticleUpdatePayload,
} from "@/types/knowledge-article";

const selectClassName =
  "border-input bg-background ring-offset-background focus-visible:ring-ring w-full rounded-sm border px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none";

export function KnowledgeArticleEditor({
  article,
}: {
  article?: KnowledgeArticle;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(article?.title ?? "");
  const [description, setDescription] = useState(article?.description ?? "");
  const [knowledgeStatus, setKnowledgeStatus] = useState<"draft" | "published">(
    article?.knowledge_status ?? "draft",
  );
  const [knowledgeVisibility, setKnowledgeVisibility] = useState<"internal" | "external">(
    article?.knowledge_visibility ?? "external",
  );
  const [tagsText, setTagsText] = useState((article?.tags ?? []).join(", "));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const tags = tagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 10);

    try {
      if (article) {
        const payload: KnowledgeArticleUpdatePayload = {
          title,
          description,
          knowledge_status: knowledgeStatus,
          knowledge_visibility: knowledgeVisibility,
          tags,
        };
        await apiPatch<KnowledgeArticle>(`/api/v1/knowledge-articles/${article.id}`, payload);
        router.refresh();
      } else {
        const payload: KnowledgeArticleCreatePayload = {
          title,
          description,
          knowledge_status: knowledgeStatus,
          knowledge_visibility: knowledgeVisibility,
          tags,
        };
        const created = await apiPost<KnowledgeArticle>("/api/v1/knowledge-articles", payload);
        router.push(`/knowledge/${created.id}`);
      }
    } catch {
      setError("Kunne ikke gemme vidensartiklen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="star-page max-w-2xl space-y-4">
      <div>
        <label className="wire-form-label" htmlFor="ka-title">
          Titel
        </label>
        <input
          id="ka-title"
          className={selectClassName}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          minLength={3}
        />
      </div>
      <div>
        <label className="wire-form-label" htmlFor="ka-description">
          Indhold
        </label>
        <textarea
          id="ka-description"
          className={`${selectClassName} min-h-[160px]`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          minLength={10}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="wire-form-label" htmlFor="ka-status">
            Status
          </label>
          <select
            id="ka-status"
            className={selectClassName}
            value={knowledgeStatus}
            onChange={(e) => setKnowledgeStatus(e.target.value as "draft" | "published")}
          >
            <option value="draft">Kladde</option>
            <option value="published">Udgivet</option>
          </select>
        </div>
        <div>
          <label className="wire-form-label" htmlFor="ka-visibility">
            Synlighed
          </label>
          <select
            id="ka-visibility"
            className={selectClassName}
            value={knowledgeVisibility}
            onChange={(e) => setKnowledgeVisibility(e.target.value as "internal" | "external")}
          >
            <option value="external">Ekstern (portal)</option>
            <option value="internal">Intern (kun teknikere)</option>
          </select>
        </div>
      </div>
      <div>
        <label className="wire-form-label" htmlFor="ka-tags">
          Emneord (kommasepareret)
        </label>
        <input
          id="ka-tags"
          className={selectClassName}
          value={tagsText}
          onChange={(e) => setTagsText(e.target.value)}
        />
      </div>
      {error ? (
        <p className="text-star-red text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={busy} className="bg-star-navy hover:bg-star-blue rounded-sm">
        {busy ? "Gemmer…" : article ? "Gem ændringer" : "Opret vidensartikel"}
      </Button>
    </form>
  );
}
