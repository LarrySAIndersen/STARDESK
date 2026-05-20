import type { KnowledgeArticle } from "@/types/knowledge-article";
import type { TicketDetail } from "@/types/ticket";

export function relatedArticlesForTicket(
  ticket: TicketDetail,
  articles: KnowledgeArticle[],
  limit = 4,
): KnowledgeArticle[] {
  const needles = [
    ticket.category_name_da,
    ticket.subcategory_name_da,
    ...(ticket.tags ?? []),
  ]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase());

  if (needles.length === 0) {
    return articles.slice(0, limit);
  }

  const scored = articles
    .map((article) => {
      const hay = `${article.title} ${article.summary} ${article.tags.join(" ")}`.toLowerCase();
      let score = 0;
      for (const needle of needles) {
        if (hay.includes(needle)) score += 2;
      }
      return { article, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return (scored.length > 0 ? scored : articles.map((a) => ({ article: a, score: 0 })))
    .slice(0, limit)
    .map((x) => x.article);
}
