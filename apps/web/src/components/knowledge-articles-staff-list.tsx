"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { KnowledgeArticle } from "@/types/knowledge-article";

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
      <div className="wire-table-wrap">
        {filtered.length === 0 ? (
          <p className="text-[var(--gray-mid)] px-3.5 py-4 text-sm">Ingen vidensartikler.</p>
        ) : (
          filtered.map((article) => (
            <Link
              key={article.id}
              href={`/knowledge/${article.id}`}
              className="my-ticket-row flex flex-wrap items-center gap-2 border-b border-[var(--gray-border)] px-3.5 py-2.5 text-xs last:border-b-0 hover:bg-star-blue-light"
            >
              <span className="font-mono font-semibold text-[var(--gray-mid)]">
                {article.ticket_number}
              </span>
              <span className="min-w-0 flex-1 font-medium">{article.title}</span>
              <span className="text-[var(--gray-mid)]">{article.knowledge_status_label_da}</span>
              <span className="text-[var(--gray-mid)]">
                {article.knowledge_visibility_label_da}
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
