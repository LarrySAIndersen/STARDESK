import { notFound, redirect } from "next/navigation";

import { KnowledgeArticleEditor } from "@/components/knowledge-article-editor";
import { ApiError } from "@/lib/api";
import { apiGetServer } from "@/lib/api-server";
import { isStaff } from "@/lib/auth";
import { getServerUser } from "@/lib/auth-server";
import type { KnowledgeArticle } from "@/types/knowledge-article";

export const dynamic = "force-dynamic";

export default async function KnowledgeArticleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const currentUser = await getServerUser();
  if (!isStaff(currentUser)) {
    redirect("/login");
  }

  try {
    const article = await apiGetServer<KnowledgeArticle>(`/api/v1/knowledge-articles/${id}`);
    return (
      <div className="wire-scroll-content min-h-0 flex-1">
        <KnowledgeArticleEditor article={article} />
      </div>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    return (
      <p className="text-star-red star-page text-sm">Kunne ikke hente vidensartiklen.</p>
    );
  }
}
