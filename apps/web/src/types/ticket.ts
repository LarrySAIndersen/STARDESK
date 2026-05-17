import type { Attachment } from "@/types/attachment";
import type { Comment } from "@/types/comment";
import type { SubCause } from "@/types/sub-cause";
import type { TicketActivityItem, TicketTimestamps } from "@/types/ticket-activity";

export interface Ticket {
  id: string;
  ticket_number: string;
  title: string;
  status: string;
  priority: string;
  ticket_type: string;
  is_major: boolean;
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
  created_at: string;
  updated_at?: string | null;
}

export interface TicketDetail extends Ticket {
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
  gdpr_consent: boolean;
  subject_cpr?: string | null;
}
