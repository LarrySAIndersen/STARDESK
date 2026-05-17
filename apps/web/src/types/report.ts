export interface ReportTicketRow {
  id: string;
  ticket_number: string;
  title: string;
  status: string;
  status_label_da: string;
  priority: string;
  ticket_type: string;
  assigned_team_name: string | null;
  assigned_user_name: string | null;
  created_at: string;
  updated_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  reopened_at: string | null;
}

export interface ReportBucket {
  key: string;
  label_da: string;
  description_da: string;
  count: number;
  tickets: ReportTicketRow[];
}

export interface StandardReport {
  generated_at: string;
  period_days: number | null;
  total_tickets: number;
  buckets: ReportBucket[];
}
