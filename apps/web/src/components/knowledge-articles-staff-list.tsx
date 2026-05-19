"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";
import { useMemo, useState } from "react";

import { formatKnowledgeUpdatedAt } from "@/lib/knowledge-article-content";
import type { KnowledgeArticle } from "@/types/knowledge-article";

function KnowledgeStatusBadge({ status }: { status: KnowledgeArticle["knowledge_status"] }) {
  if (status === "published") {
    return <span className="wire-badge wire-badge--resolved">Udgivet</span>;
  }
  return <span className="wire-badge wire-badge--pending">Kladde</span>;
}

function KnowledgeVisibilityBadge({
  visibility,
}: {
  visibility: KnowledgeArticle["knowledge_visibility"];
}) {
  if (visibility === "external") {
    return <span className="wire-badge wire-badge--open">Ekstern</span>;
  }
  return <span className="wire-badge wire-badge--low">Intern</span>;
}

export function KnowledgeArticlesStaffList({ articles }: { articles: KnowledgeArticle[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return articles;
    }
    return articles.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.ticket_number.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [articles, query]);

  return (
    <div className="star-page space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-star-navy text-xl font-bold tracking-tight">Vidensartikler</h1>
          <p className="text-[var(--gray-mid)] mt-1 text-sm">
            Opret, udgiv og vedligehold viden til portal og teknikere.
          </p>
        </div>
        <Link href="/knowledge/new" className="wire-btn wire-btn-red">
          + Ny vidensartikel
        </Link>
      </div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Søg titel, indhold, emneord…"
        className="wire-search-input max-w-md"
        aria-label="Søg vidensartikler"
      />
      <div className="wire-table-wrap min-w-0 overflow-x-auto">
        <div
          className="wire-table-head wire-table-grid-knowledge min-w-[44rem]"
          role="row"
        >
          <span>KB-nr.</span>
          <span>Titel</span>
          <span>Status</span>
          <span>Synlighed</span>
          <span>Opdateret</span>
          <span className="text-right">Handling</span>
        </div>
        {filtered.length === 0 ? (
          <p className="text-[var(--gray-mid)] px-3.5 py-4 text-sm">Ingen vidensartikler.</p>
        ) : (
          filtered.map((article) => (
            <div
              key={article.id}
              role="row"
              className="wire-table-row wire-table-row--compact wire-table-grid-knowledge min-w-[44rem] items-center"
            >
              <span className="font-mono text-[11px] font-semibold text-[var(--gray-mid)]">
                {article.ticket_number}
              </span>
              <span className="text-star-navy min-w-0 truncate text-xs font-medium">
                {article.title}
              </span>
              <span>
                <KnowledgeStatusBadge status={article.knowledge_status} />
              </span>
              <span>
                <KnowledgeVisibilityBadge visibility={article.knowledge_visibility} />
              </span>
              <span className="text-[var(--gray-mid)] text-[11px]">
                {formatKnowledgeUpdatedAt(article.updated_at ?? article.created_at)}
              </span>
              <span className="flex justify-end">
                <Link
                  href={`/knowledge/${article.id}`}
                  className="text-star-blue hover:text-star-navy inline-flex items-center gap-1 text-[11px] font-semibold underline underline-offset-2"
                >
                  <Pencil className="size-3" aria-hidden />
                  Rediger
                </Link>
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
