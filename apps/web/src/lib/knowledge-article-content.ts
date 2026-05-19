import type { KnowledgeArticle } from "@/types/knowledge-article";

export type KnowledgeArticleSections = {
  summary: string;
  symptoms: string;
  solution: string;
  related_topics: string;
};

export const EMPTY_KNOWLEDGE_SECTIONS: KnowledgeArticleSections = {
  summary: "",
  symptoms: "",
  solution: "",
  related_topics: "",
};

export function sectionsFromArticle(article: KnowledgeArticle): KnowledgeArticleSections {
  return {
    summary: article.summary ?? "",
    symptoms: article.symptoms ?? "",
    solution: article.solution ?? "",
    related_topics: article.related_topics ?? "",
  };
}

export function sectionsHaveContent(sections: KnowledgeArticleSections): boolean {
  return (
    sections.summary.trim().length +
      sections.symptoms.trim().length +
      sections.solution.trim().length +
      sections.related_topics.trim().length >=
    10
  );
}

export function formatKnowledgeUpdatedAt(iso: string | null | undefined): string {
  if (!iso) {
    return "—";
  }
  try {
    return new Intl.DateTimeFormat("da-DK", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}
