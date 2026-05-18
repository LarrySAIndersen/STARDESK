import { redirect } from "next/navigation";

import { KnowledgeArticleEditor } from "@/components/knowledge-article-editor";
import { isStaff } from "@/lib/auth";
import { getServerUser } from "@/lib/auth-server";

export default async function NewKnowledgeArticlePage() {
  const currentUser = await getServerUser();
  if (!isStaff(currentUser)) {
    redirect("/login");
  }

  return (
    <div className="wire-scroll-content min-h-0 flex-1">
      <KnowledgeArticleEditor />
    </div>
  );
}
