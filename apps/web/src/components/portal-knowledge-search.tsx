"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { KnowledgeArticle } from "@/types/knowledge-article";

export function PortalKnowledgeSearch({
  articles,
  basePath = "/portal/knowledge",
}: {
  articles: KnowledgeArticle[];
  basePath?: string;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return articles;
    }
    return articles.filter((article) => {
      if (article.title.toLowerCase().includes(q)) {
        return true;
      }
      if (article.description.toLowerCase().includes(q)) {
        return true;
      }
      return article.tags.some((tag) => tag.toLowerCase().includes(q));
    });
  }, [articles, query]);

  return (
    <div className="space-y-4">
      <section className="wire-portal-hero">
        <h2 className="text-xl font-bold tracking-tight">Søg vidensbase</h2>
        <p className="mt-1 text-[13px] text-white/75">
          Find vejledninger og løsninger fra STAR Service Desk.
        </p>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Søg på titel, indhold eller emneord…"
          className="mt-3 w-full max-w-md rounded-[2px] border-2 border-white/30 bg-white/10 px-3.5 py-2 text-[13px] text-white outline-none placeholder:text-white/50 focus:border-white"
          aria-label="Søg vidensartikler"
        />
      </section>

      {filtered.length === 0 ? (
        <p className="text-[var(--gray-mid)] text-sm">
          {query.trim() ? "Ingen artikler matcher din søgning." : "Ingen vidensartikler endnu."}
        </p>
      ) : (
        <div className="wire-table-wrap">
          {filtered.map((article) => (
            <Link
              key={article.id}
              href={`${basePath}/${article.id}`}
              className="my-ticket-row flex flex-col gap-0.5 border-b border-[var(--gray-border)] px-3.5 py-2.5 text-xs last:border-b-0 hover:bg-star-blue-light sm:flex-row sm:items-center sm:gap-2"
            >
              <span className="font-mono font-semibold text-[var(--gray-mid)] shrink-0">
                {article.ticket_number}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">{article.title}</span>
              {article.tags.length > 0 ? (
                <span className="text-[var(--gray-mid)] truncate">
                  {article.tags.slice(0, 3).join(" · ")}
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
