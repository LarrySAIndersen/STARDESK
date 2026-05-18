import { redirect } from "next/navigation";

import { KnowledgeArticlesStaffList } from "@/components/knowledge-articles-staff-list";
import { ApiError } from "@/lib/api";
import { apiGetServer } from "@/lib/api-server";
import { isStaff } from "@/lib/auth";
import { getServerUser } from "@/lib/auth-server";
import type { KnowledgeArticle } from "@/types/knowledge-article";

export const dynamic = "force-dynamic";

export default async function KnowledgeArticlesPage() {
  const currentUser = await getServerUser();
  if (!isStaff(currentUser)) {
    redirect("/login");
  }

  let articles: KnowledgeArticle[] = [];
  let fetchError: string | null = null;

  try {
    articles = await apiGetServer<KnowledgeArticle[]>("/api/v1/knowledge-articles?limit=500");
  } catch (error) {
    if (error instanceof ApiError) {
      fetchError = `Kunne ikke hente vidensartikler (API ${error.status}).`;
    } else {
      fetchError = "Kunne ikke hente vidensartikler.";
    }
  }

  return (
    <div className="wire-scroll-content min-h-0 flex-1">
      {fetchError ? (
        <p className="text-star-red star-page text-sm">{fetchError}</p>
      ) : (
        <KnowledgeArticlesStaffList articles={articles} />
      )}
    </div>
  );
}
