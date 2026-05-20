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
  description?: string;
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
  assigned_user_id?: string | null;
  assigned_user_name?: string | null;
  fault_displayed?: boolean;
  assignment_reason?: string | null;
  reporter_display_name?: string | null;
  response_due_at?: string | null;
  resolution_due_at?: string | null;
  sla_remaining_seconds?: number | null;
  sla_breached?: boolean;
  created_at: string;
  updated_at?: string | null;
  tags?: string[];
  emoji?: string | null;
  routing?: TicketRouting | null;
  is_knowledge_article?: boolean;
  knowledge_status?: string | null;
  knowledge_status_label_da?: string | null;
  knowledge_visibility?: string | null;
  knowledge_visibility_label_da?: string | null;
  /** DB: portal | email | api | phone | chat | knowledge */
  source?: string;
  source_label_da?: string;
}

export interface TicketIntake {
  answers: Record<string, string>;
}

export interface TicketRouting {
  completeness_score: number;
  routing_ready: boolean;
  missing_fields_da: string[];
  intake: TicketIntake;
  suggested_team_id?: string | null;
  suggested_team_name?: string | null;
  routing_confidence?: number | null;
  routing_reason_da?: string | null;
  computed_priority: string;
  computed_priority_label_da: string;
  computed_priority_reasons_da: string[];
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

export interface TicketEmail {
  id: string;
  direction: "inbound" | "outbound";
  subject?: string | null;
  from_email?: string | null;
  to_email?: string | null;
  body_text?: string | null;
  received_at: string;
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
  routing?: TicketRouting | null;
  prompt_snippet_da: string;
  evaluation_rubric_da: string;
}

export interface TicketDetail extends Ticket {
  children?: TicketSummary[];
  related_major_tickets?: TicketSummary[];
  intelligence?: TicketIntelligence | null;
  description: string; // required on detail
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
  ticket_emails?: TicketEmail[];
  linked_gmail_email?: string | null;
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
  intake_answers?: Record<string, string>;
  /** Kun agenter — sendes til API; slutbrugere ignorerer feltet (portal). */
  source?: "portal" | "email" | "phone" | "chat";
}
