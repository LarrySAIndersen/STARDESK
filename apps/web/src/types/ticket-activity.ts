export interface TicketTimestamps {
  created_at: string;
  updated_at: string | null;
  gdpr_consent_at: string | null;
  assigned_at: string | null;
  in_progress_at: string | null;
  on_hold_at: string | null;
  first_response_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  cancelled_at: string | null;
  last_escalation_at: string | null;
  response_due_at: string | null;
  resolution_due_at: string | null;
}

export interface TicketActivityItem {
  id: string;
  occurred_at: string;
  event_type: string;
  label_da: string;
  actor_display_name: string | null;
  visibility: "internal" | "external" | "system";
  detail: string | null;
}
