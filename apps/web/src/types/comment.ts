export type CommentVisibility = "internal" | "external";

export interface CommentReactionSummary {
  positive_count: number;
  negative_count: number;
  current_user_sentiment: "positive" | "negative" | null;
}

export interface Comment {
  id: string;
  body: string;
  is_internal: boolean;
  visibility: CommentVisibility;
  visibility_label_da: string;
  author_display_name: string;
  created_at: string;
  reactions?: CommentReactionSummary;
}
