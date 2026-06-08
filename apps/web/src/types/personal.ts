import type { Ticket } from "@/types/ticket";

import type { PersonalNoteCategoryId } from "@/lib/personal-note-categories";

export type PersonalNote = {
  id: string;
  user_id: string;
  note_number: string;
  title: string;
  content: string;
  is_pinned: boolean;
  sort_order: number;
  board_x?: number | null;
  board_y?: number | null;
  color: string | null;
  category: PersonalNoteCategoryId | string | null;
  ticket_id: string | null;
  visibility: PersonalNoteVisibility | null;
  author_name?: string | null;
  ticket_number?: string | null;
  created_at: string;
  updated_at: string;
};

export type PersonalNoteVisibility = "private" | "team";

export type TicketPostItSummary = {
  ticket_id: string;
  count: number;
};

export type PersonalKanbanCard = {
  user_id: string;
  ticket_id: string;
  column_name: string;
  sort_order: number;
  created_at: string;
};

export type PersonalKanban = {
  columns: string[];
  cards: PersonalKanbanCard[];
  tickets: Ticket[];
};

export const PERSONAL_KANBAN_COLUMNS = ["Min kø", "I gang", "Færdig"] as const;

export type PersonalNoteCreate = {
  title: string;
  content?: string;
  is_pinned?: boolean;
  color?: string | null;
  category?: PersonalNoteCategoryId | null;
  ticket_id?: string | null;
  visibility?: PersonalNoteVisibility;
};

export type PersonalNoteUpdate = {
  title?: string;
  content?: string;
  is_pinned?: boolean;
  sort_order?: number;
  board_x?: number | null;
  board_y?: number | null;
  color?: string | null;
  category?: PersonalNoteCategoryId | null;
  ticket_id?: string | null;
  visibility?: PersonalNoteVisibility;
};
