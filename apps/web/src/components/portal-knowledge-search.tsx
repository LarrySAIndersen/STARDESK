"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";

import { ClearFiltersButton } from "@/components/clear-filters-button";
import { useListFilters } from "@/hooks/use-list-filters";
import type { KnowledgeArticle } from "@/types/knowledge-article";

export function PortalKnowledgeSearch({
  articles,
  basePath = "/portal/knowledge",
}: {
  articles: KnowledgeArticle[];
  basePath?: string;
}) {
  const searchParams = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { search: query, setSearch: setQuery, reset, hasActiveFilters } = useListFilters({
    defaultFilters: {},
  });

  useEffect(() => {
    if (searchParams.get("focus") === "search") {
      searchInputRef.current?.focus();
    }
  }, [searchParams]);

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
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            ref={searchInputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Søg på titel, indhold eller emneord…"
            className="wire-search-input wire-search-input--on-dark max-w-md"
            aria-label="Søg vidensartikler"
          />
          <ClearFiltersButton onClick={reset} visible={hasActiveFilters} />
        </div>
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
