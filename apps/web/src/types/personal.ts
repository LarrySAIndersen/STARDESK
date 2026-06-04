import type { Ticket } from "@/types/ticket";

export type PersonalNote = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  is_pinned: boolean;
  sort_order: number;
  color: string | null;
  created_at: string;
  updated_at: string;
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
};

export type PersonalNoteUpdate = {
  title?: string;
  content?: string;
  is_pinned?: boolean;
  sort_order?: number;
  color?: string | null;
};
