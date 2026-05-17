export type CommentVisibility = "internal" | "external";

export interface Comment {
  id: string;
  body: string;
  is_internal: boolean;
  visibility: CommentVisibility;
  visibility_label_da: string;
  author_display_name: string;
  created_at: string;
}
