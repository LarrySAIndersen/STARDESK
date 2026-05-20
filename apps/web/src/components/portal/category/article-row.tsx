import Link from "next/link";
import { FileText } from "lucide-react";

import { formatDateTimeDa } from "@/lib/utils";
import type { KnowledgeArticle } from "@/types/knowledge-article";

export function ArticleRow({ article }: { article: KnowledgeArticle }) {
  const excerpt =
    article.summary?.trim() ||
    article.description?.slice(0, 140) ||
    "Ingen beskrivelse tilgængelig.";

  return (
    <Link
      href={`/portal/knowledge/${article.id}`}
      className="portal-v2-list-row group flex gap-3 px-1 py-3"
    >
      <FileText
        className="text-star-navy/50 mt-0.5 size-[18px] shrink-0 group-hover:text-star-red"
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <h3 className="text-star-navy text-[14px] font-semibold group-hover:text-star-red">
          {article.title}
        </h3>
        <p className="text-[var(--gray-mid)] mt-0.5 line-clamp-2 text-[12px] leading-snug">
          {excerpt}
        </p>
        <p className="text-[var(--gray-mid)] mt-1.5 text-[11px] tabular-nums">
          Opdateret {formatDateTimeDa(article.updated_at ?? article.created_at)}
          {article.tags.length > 0 ? (
            <>
              <span aria-hidden> · </span>
              {article.tags.slice(0, 3).join(", ")}
            </>
          ) : null}
        </p>
      </div>
    </Link>
  );
}
