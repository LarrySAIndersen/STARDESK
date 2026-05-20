"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { ArticleRow } from "@/components/portal/category/article-row";
import { CategoryHeader } from "@/components/portal/category/category-header";
import { CategoryScopedSearch } from "@/components/portal/category/category-scoped-search";
import { DepartmentTicketsBox } from "@/components/portal/category/department-tickets-box";
import { ServiceCard } from "@/components/portal/category/service-card";
import type { PortalServiceItem } from "@/lib/portal-category";
import type { KnowledgeArticle } from "@/types/knowledge-article";
import type { Ticket } from "@/types/ticket";

function matchesQuery(text: string, query: string): boolean {
  if (!query.trim()) return true;
  return text.toLowerCase().includes(query.trim().toLowerCase());
}

export function CategoryPageContent({
  slug,
  nameDa,
  description,
  icon,
  services,
  articles,
  deptTickets,
}: {
  slug: string;
  nameDa: string;
  description: string;
  icon: string;
  services: PortalServiceItem[];
  articles: KnowledgeArticle[];
  deptTickets: Ticket[];
}) {
  const [query, setQuery] = useState("");

  const filteredServices = useMemo(
    () =>
      services.filter(
        (s) =>
          matchesQuery(s.title, query) ||
          matchesQuery(s.description, query),
      ),
    [services, query],
  );

  const filteredArticles = useMemo(
    () =>
      articles.filter(
        (a) =>
          matchesQuery(a.title, query) ||
          matchesQuery(a.summary, query) ||
          matchesQuery(a.tags.join(" "), query),
      ),
    [articles, query],
  );

  const popularServices = filteredServices.slice(0, 6);

  return (
    <div className="portal-v2-page mx-auto w-full max-w-5xl space-y-8 p-4 pb-10 sm:p-6">
      <CategoryHeader
        nameDa={nameDa}
        description={description}
        icon={icon}
        articleCount={articles.length}
        serviceCount={services.length}
        openTicketCount={deptTickets.length}
      />

      <CategoryScopedSearch categoryName={nameDa} onQueryChange={setQuery} />

      <section className="space-y-3" aria-labelledby="popular-services-heading">
        <div className="flex items-end justify-between gap-2">
          <h2 id="popular-services-heading" className="portal-v2-section-title">
            Populære services
          </h2>
        </div>
        {popularServices.length === 0 ? (
          <p className="text-[var(--gray-mid)] text-sm">
            Ingen services matcher din søgning.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {popularServices.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        )}
        {services.length > 6 ? (
          <Link
            href={`/tickets/new`}
            className="text-star-red inline-flex text-[13px] font-semibold hover:underline"
          >
            Se alle services →
          </Link>
        ) : null}
      </section>

      <section className="space-y-1" aria-labelledby="knowledge-heading">
        <h2 id="knowledge-heading" className="portal-v2-section-title mb-2">
          Vidensartikler
        </h2>
        {filteredArticles.length === 0 ? (
          <div className="portal-v2-empty py-8">
            <p className="text-[var(--gray-mid)] text-sm">
              {query
                ? "Ingen artikler matcher din søgning."
                : "Ingen artikler i denne kategori endnu."}
            </p>
            <Link href="/portal/knowledge" className="text-star-red mt-2 text-sm font-semibold">
              Gå til vidensbasen →
            </Link>
          </div>
        ) : (
          <div className="portal-v2-card divide-y divide-[var(--gray-border)] px-3">
            {filteredArticles.map((article) => (
              <ArticleRow key={article.id} article={article} />
            ))}
          </div>
        )}
      </section>

      <DepartmentTicketsBox tickets={deptTickets} />

      <p className="text-[var(--gray-mid)] text-center text-[11px]">
        <Link href={`/portal-v2/kategori/${slug}`} className="sr-only">
          Kategori v2
        </Link>
        <Link href="/portal" className="hover:text-star-navy underline">
          Tilbage til oversigt
        </Link>
      </p>
    </div>
  );
}
