import { redirect } from "next/navigation";

import { PortalKnowledgeSearch } from "@/components/portal-knowledge-search";
import { ApiError } from "@/lib/api";
import { apiGetServer } from "@/lib/api-server";
import { canAccessPortalKnowledge } from "@/lib/portal-access";
import { getServerUser } from "@/lib/auth-server";
import type { KnowledgeArticle } from "@/types/knowledge-article";

export const dynamic = "force-dynamic";

export default async function PortalKnowledgePage() {
  const currentUser = await getServerUser();
  if (!canAccessPortalKnowledge(currentUser)) {
    redirect("/login");
  }

  let articles: KnowledgeArticle[] = [];
  let fetchError: string | null = null;

  try {
    articles = await apiGetServer<KnowledgeArticle[]>(
      "/api/v1/knowledge-articles?portal=true&limit=200",
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      fetchError = "Du har ikke adgang til vidensartikler.";
    } else {
      fetchError = "Kunne ikke hente vidensartikler. Tjek at backend kører.";
    }
  }

  return (
    <div className="space-y-4 p-1">
      {fetchError ? <p className="text-star-red text-sm">{fetchError}</p> : null}
      <PortalKnowledgeSearch articles={articles} />
    </div>
  );
}
