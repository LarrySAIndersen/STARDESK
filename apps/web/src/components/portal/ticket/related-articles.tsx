import Link from "next/link";
import { BookOpen } from "lucide-react";

import type { KnowledgeArticle } from "@/types/knowledge-article";

export function RelatedArticles({ articles }: { articles: KnowledgeArticle[] }) {
  if (articles.length === 0) {
    return null;
  }

  return (
    <aside className="portal-v2-card p-4" aria-labelledby="related-articles-heading">
      <h2 id="related-articles-heading" className="portal-v2-section-title mb-3">
        Relateret viden
      </h2>
      <ul className="space-y-2">
        {articles.map((article) => (
          <li key={article.id}>
            <Link
              href={`/portal/knowledge/${article.id}`}
              className="text-foreground hover:text-primary flex gap-2 text-[13px] font-medium"
            >
              <BookOpen className="mt-0.5 size-4 shrink-0 opacity-60" aria-hidden />
              <span className="line-clamp-2">{article.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
