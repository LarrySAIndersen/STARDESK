"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { apiPatch, apiPost } from "@/lib/api";
import { EMPTY_KNOWLEDGE_SECTIONS, sectionsFromArticle } from "@/lib/knowledge-article-content";
import type {
  KnowledgeArticle,
  KnowledgeArticleCreatePayload,
  KnowledgeArticleUpdatePayload,
} from "@/types/knowledge-article";

const selectClassName =
  "border-input bg-background ring-offset-background focus-visible:ring-ring w-full rounded-sm border px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none";

const textareaClassName = `${selectClassName} min-h-[88px]`;

export function KnowledgeArticleEditor({
  article,
}: {
  article?: KnowledgeArticle;
}) {
  const router = useRouter();
  const initialSections = article ? sectionsFromArticle(article) : EMPTY_KNOWLEDGE_SECTIONS;
  const [title, setTitle] = useState(article?.title ?? "");
  const [summary, setSummary] = useState(initialSections.summary);
  const [symptoms, setSymptoms] = useState(initialSections.symptoms);
  const [solution, setSolution] = useState(initialSections.solution);
  const [relatedTopics, setRelatedTopics] = useState(initialSections.related_topics);
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

    const sectionPayload = {
      summary: summary.trim(),
      symptoms: symptoms.trim(),
      solution: solution.trim(),
      related_topics: relatedTopics.trim(),
    };

    try {
      if (article) {
        const payload: KnowledgeArticleUpdatePayload = {
          title,
          ...sectionPayload,
          knowledge_status: knowledgeStatus,
          knowledge_visibility: knowledgeVisibility,
          tags,
        };
        await apiPatch<KnowledgeArticle>(`/api/v1/knowledge-articles/${article.id}`, payload);
        router.refresh();
      } else {
        const payload: KnowledgeArticleCreatePayload = {
          title,
          ...sectionPayload,
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
    <form onSubmit={onSubmit} className="star-page max-w-3xl space-y-4">
      {article ? (
        <p className="font-mono text-xs text-[var(--gray-mid)]">{article.ticket_number}</p>
      ) : null}
      <h1 className="text-star-navy text-xl font-bold tracking-tight">
        {article ? "Rediger vidensartikel" : "Ny vidensartikel"}
      </h1>

      <div className="wire-card space-y-4">
        <h2 className="wire-card-title">Grunddata</h2>
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
      </div>

      <div className="wire-card space-y-4">
        <h2 className="wire-card-title">Indhold</h2>
        <div>
          <label className="wire-form-label" htmlFor="ka-summary">
            Resumé
          </label>
          <textarea
            id="ka-summary"
            className={textareaClassName}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Kort beskrivelse af problemet og løsningen."
          />
        </div>
        <div>
          <label className="wire-form-label" htmlFor="ka-symptoms">
            Symptomer
          </label>
          <textarea
            id="ka-symptoms"
            className={textareaClassName}
            value={symptoms}
            onChange={(e) => setSymptoms(e.target.value)}
            placeholder="- Fejlmeddelelse&#10;- Hvornår opstår det?"
          />
        </div>
        <div>
          <label className="wire-form-label" htmlFor="ka-solution">
            Løsning
          </label>
          <textarea
            id="ka-solution"
            className={`${textareaClassName} min-h-[120px]`}
            value={solution}
            onChange={(e) => setSolution(e.target.value)}
            required={!article}
            placeholder="Trin-for-trin vejledning."
          />
        </div>
        <div>
          <label className="wire-form-label" htmlFor="ka-related">
            Relaterede emner
          </label>
          <textarea
            id="ka-related"
            className={textareaClassName}
            value={relatedTopics}
            onChange={(e) => setRelatedTopics(e.target.value)}
            placeholder="Links til andre artikler eller interne systemer."
          />
        </div>
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
