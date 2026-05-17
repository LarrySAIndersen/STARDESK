import type { Comment } from "@/types/comment";

export interface Ticket {
  id: string;
  ticket_number: string;
  title: string;
  status: string;
  priority: string;
  ticket_type: string;
  created_at: string;
}

export interface TicketDetail extends Ticket {
  description: string;
  category_id: string | null;
  subcategory_id: string | null;
  assigned_team_id: string | null;
  response_due_at: string | null;
  resolution_due_at: string | null;
  escalation_level: number;
  comments: Comment[];
}

export interface TicketCreateInput {
  ticket_type: "service_request" | "incident" | "problem";
  title: string;
  description: string;
  priority: "critical" | "high" | "medium" | "low";
  category_id?: string | null;
  subcategory_id?: string | null;
}
