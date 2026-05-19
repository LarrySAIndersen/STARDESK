import { sectionsHaveContent, sectionsFromArticle } from "@/lib/knowledge-article-content";
import type { KnowledgeArticle } from "@/types/knowledge-article";

function SectionBlock({ title, body }: { title: string; body: string }) {
  const lines = body.split("\n").filter((line) => line.trim().length > 0);
  const looksLikeList = lines.length > 1 && lines.every((line) => /^[-*•]\s/.test(line.trim()));

  return (
    <section className="wire-card">
      <h2 className="wire-card-title">{title}</h2>
      {looksLikeList ? (
        <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-[var(--star-text)]">
          {lines.map((line) => (
            <li key={line}>{line.replace(/^[-*•]\s*/, "")}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm leading-relaxed whitespace-pre-wrap text-[var(--star-text)]">{body}</p>
      )}
    </section>
  );
}

export function KnowledgeArticleBody({ article }: { article: KnowledgeArticle }) {
  const sections = sectionsFromArticle(article);

  if (!sectionsHaveContent(sections)) {
    return (
      <div className="wire-card">
        <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm text-[var(--star-text)]">
          {article.description}
        </div>
      </div>
    );
  }

  const blocks: { title: string; body: string }[] = [];
  if (sections.summary.trim()) {
    blocks.push({ title: "Resumé", body: sections.summary });
  }
  if (sections.symptoms.trim()) {
    blocks.push({ title: "Symptomer", body: sections.symptoms });
  }
  if (sections.solution.trim()) {
    blocks.push({ title: "Løsning", body: sections.solution });
  }
  if (sections.related_topics.trim()) {
    blocks.push({ title: "Relaterede emner", body: sections.related_topics });
  }

  return (
    <div className="space-y-3">
      {blocks.map((block) => (
        <SectionBlock key={block.title} title={block.title} body={block.body} />
      ))}
    </div>
  );
}
