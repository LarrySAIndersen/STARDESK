import { notFound, redirect } from "next/navigation";

import { CategoryPageContent } from "@/components/portal/category/category-page-content";
import { ApiError } from "@/lib/api";
import { apiGetServer } from "@/lib/api-server";
import { canAccessPortalKnowledge } from "@/lib/portal-access";
import {
  filterArticlesForCategory,
  filterOpenDeptTickets,
  getPortalServicesForCategory,
  resolvePortalCategory,
} from "@/lib/portal-category";
import { getServerUser } from "@/lib/auth-server";
import type { Category } from "@/types/category";
import type { KnowledgeArticle } from "@/types/knowledge-article";
import type { Ticket } from "@/types/ticket";

export const dynamic = "force-dynamic";

export default async function PortalV2CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const currentUser = await getServerUser();
  if (!currentUser) {
    redirect("/login");
  }

  let apiCategories: Category[] = [];
  try {
    apiCategories = await apiGetServer<Category[]>("/api/v1/categories", { revalidate: 300 });
  } catch {
    apiCategories = [];
  }

  const resolved = resolvePortalCategory(slug, apiCategories);
  if (!resolved) {
    notFound();
  }

  let articles: KnowledgeArticle[] = [];
  let tickets: Ticket[] = [];

  try {
    if (canAccessPortalKnowledge(currentUser)) {
      articles = await apiGetServer<KnowledgeArticle[]>(
        "/api/v1/knowledge-articles?portal=true&limit=200",
      );
    }
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 403)) {
      articles = [];
    }
  }

  try {
    tickets = await apiGetServer<Ticket[]>("/api/v1/tickets");
  } catch {
    tickets = [];
  }

  const services = getPortalServicesForCategory(slug);
  const categoryArticles = filterArticlesForCategory(articles, resolved.nameDa);
  const deptTickets = filterOpenDeptTickets(tickets, resolved.nameDa);

  return (
    <CategoryPageContent
      slug={slug}
      nameDa={resolved.nameDa}
      description={resolved.description}
      icon={resolved.icon}
      services={services}
      articles={categoryArticles}
      deptTickets={deptTickets}
    />
  );
}
