export type ReviewNoteStatus = "open" | "resolved";

export interface ReviewNote {
  id: string;
  page_path: string;
  page_title: string;
  comment: string;
  position_x: number;
  position_y: number;
  position_selector?: string | null;
  created_by_user_id: string;
  created_by_name: string;
  created_by_email?: string | null;
  status: ReviewNoteStatus;
  created_at: string;
  updated_at: string;
}

export interface ReviewNoteCreatePayload {
  page_path: string;
  page_title: string;
  comment: string;
  position_x: number;
  position_y: number;
  position_selector?: string | null;
}
