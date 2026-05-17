import type { Attachment } from "@/types/attachment";
import type { Comment } from "@/types/comment";
import type { SubCause } from "@/types/sub-cause";
import type { TicketActivityItem, TicketTimestamps } from "@/types/ticket-activity";

export interface TicketSummary {
  id: string;
  ticket_number: string;
  title: string;
  status: string;
  priority: string;
  is_major: boolean;
}

export interface Ticket {
  id: string;
  ticket_number: string;
  title: string;
  status: string;
  priority: string;
  ticket_type: string;
  is_major: boolean;
  is_shared?: boolean;
  is_security_ticket?: boolean;
  parent_ticket_id?: string | null;
  parent?: TicketSummary | null;
  child_count?: number;
  sub_causes: SubCause[];
  category_name_da?: string | null;
  subcategory_name_da?: string | null;
  assigned_team_id?: string | null;
  assigned_team_name?: string | null;
  fault_displayed?: boolean;
  assignment_reason?: string | null;
  assigned_user_name?: string | null;
  reporter_display_name?: string | null;
  response_due_at?: string | null;
  resolution_due_at?: string | null;
  sla_remaining_seconds?: number | null;
  sla_breached?: boolean;
  created_at: string;
  updated_at?: string | null;
  tags?: string[];
  emoji?: string | null;
}

export interface TicketIntelligence {
  semantic_topics: string[];
  ease_score: number | null;
  ease_label_da: string | null;
  complexity_score: number | null;
  complexity_label_da: string | null;
  llm_summary: string | null;
  handling_hints: string[];
  source: string | null;
  updated_at: string | null;
}

export interface TicketLlmContext {
  schema_version: string;
  ticket_id: string;
  ticket_number: string;
  intelligence: TicketIntelligence;
  semantic_bundle: {
    title: string;
    description: string;
    tags: string[];
    emoji: string | null;
    category_name_da: string | null;
    subcategory_name_da: string | null;
    sub_cause_names_da: string[];
    combined_text: string;
  };
  operational: Record<string, unknown>;
  prompt_snippet_da: string;
  evaluation_rubric_da: string;
}

export interface TicketDetail extends Ticket {
  children?: TicketSummary[];
  related_major_tickets?: TicketSummary[];
  intelligence?: TicketIntelligence | null;
  description: string;
  category_id: string | null;
  subcategory_id: string | null;
  assigned_team_id: string | null;
  assigned_team_name: string | null;
  assigned_user_id: string | null;
  assigned_user_name: string | null;
  response_due_at: string | null;
  resolution_due_at: string | null;
  escalation_level: number;
  gdpr_consent: boolean;
  gdpr_consent_at: string | null;
  subject_cpr: string | null;
  attachments: Attachment[];
  comments: Comment[];
  timestamps?: TicketTimestamps;
  activity?: TicketActivityItem[];
}

export interface TicketCreateInput {
  ticket_type: "service_request" | "incident" | "problem";
  title: string;
  description: string;
  priority: "critical" | "high" | "medium" | "low";
  category_id?: string | null;
  subcategory_id?: string | null;
  sub_cause_ids?: string[];
  is_major?: boolean;
  is_security_ticket?: boolean;
  parent_ticket_id?: string | null;
  gdpr_consent: boolean;
  subject_cpr?: string | null;
  tags?: string[];
  emoji?: string | null;
}
