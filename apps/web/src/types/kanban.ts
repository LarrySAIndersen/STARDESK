import type { Ticket } from "@/types/ticket";

export type KanbanMemberRole = "owner" | "editor" | "viewer";

export type KanbanBoardSummary = {
  id: string;
  name: string;
  description: string | null;
  team_id: string | null;
  team_name: string | null;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  my_role: KanbanMemberRole | null;
};

export type KanbanBoardMember = {
  user_id: string;
  display_name: string;
  role: KanbanMemberRole;
};

export type KanbanColumn = {
  id: string;
  name: string;
  position: number;
  statuses: string[];
  default_status: string | null;
  is_custom: boolean;
  wip_limit: number | null;
};

export type KanbanCard = {
  ticket: Ticket;
  position: number;
};

export type KanbanColumnWithCards = {
  column: KanbanColumn;
  cards: KanbanCard[];
};

export type KanbanBoardDetail = {
  board: KanbanBoardSummary;
  columns: KanbanColumnWithCards[];
  members: KanbanBoardMember[];
  can_edit: boolean;
  can_move_cards: boolean;
  can_remove_cards: boolean;
  can_delete_board: boolean;
  can_delete_tickets: boolean;
};

export type KanbanTicketSearchResult = {
  id: string;
  ticket_number: string;
  title: string;
  status: string;
  priority: string;
  assigned_team_name: string | null;
  assigned_user_name: string | null;
};
