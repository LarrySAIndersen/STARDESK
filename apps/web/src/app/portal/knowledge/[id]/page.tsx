import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { KnowledgeArticleBody } from "@/components/knowledge-article-body";
import { ApiError } from "@/lib/api";
import { apiGetServer } from "@/lib/api-server";
import { canAccessPortalKnowledge } from "@/lib/portal-access";
import { getServerUser } from "@/lib/auth-server";
import type { KnowledgeArticle } from "@/types/knowledge-article";

export const dynamic = "force-dynamic";

export default async function PortalKnowledgeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const currentUser = await getServerUser();
  if (!canAccessPortalKnowledge(currentUser)) {
    redirect("/login");
  }

  try {
    const article = await apiGetServer<KnowledgeArticle>(`/api/v1/knowledge-articles/${id}`);
    return (
      <article className="star-page max-w-3xl space-y-4">
        <Link href="/portal/knowledge" className="text-star-blue text-sm underline">
          ← Tilbage til vidensartikler
        </Link>
        <header className="space-y-2">
          <p className="font-mono text-xs text-[var(--gray-mid)]">{article.ticket_number}</p>
          <h1 className="text-star-navy text-xl font-bold tracking-tight">{article.title}</h1>
          {article.tags.length > 0 ? (
            <p className="flex flex-wrap gap-1.5">
              {article.tags.map((tag) => (
                <span key={tag} className="wire-tag wire-tag--gray">
                  {tag}
                </span>
              ))}
            </p>
          ) : null}
        </header>
        <KnowledgeArticleBody article={article} />
      </article>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    return (
      <p className="text-star-red text-sm">
        Kunne ikke hente artiklen.{" "}
        <Link href="/portal/knowledge" className="text-star-blue underline">
          Gå tilbage
        </Link>
      </p>
    );
  }
}
