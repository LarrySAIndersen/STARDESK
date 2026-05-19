export interface KnowledgeArticle {
  id: string;
  ticket_number: string;
  title: string;
  description: string;
  summary: string;
  symptoms: string;
  solution: string;
  related_topics: string;
  knowledge_status: "draft" | "published";
  knowledge_status_label_da: string;
  knowledge_visibility: "internal" | "external";
  knowledge_visibility_label_da: string;
  tags: string[];
  created_at: string;
  updated_at?: string | null;
}

export interface KnowledgeArticleCreatePayload {
  title: string;
  description?: string;
  summary?: string;
  symptoms?: string;
  solution?: string;
  related_topics?: string;
  knowledge_status: "draft" | "published";
  knowledge_visibility: "internal" | "external";
  tags: string[];
}

export interface KnowledgeArticleUpdatePayload {
  title?: string;
  description?: string;
  summary?: string;
  symptoms?: string;
  solution?: string;
  related_topics?: string;
  knowledge_status?: "draft" | "published";
  knowledge_visibility?: "internal" | "external";
  tags?: string[];
}

export interface KnowledgeArticlePromotePayload {
  knowledge_status: "draft" | "published";
  knowledge_visibility: "internal" | "external";
}
