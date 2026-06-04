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

// Custom Report Types
export interface CustomReportGroupRow {
  group_key: string;
  group_label_da: string;
  count: number;
  percentage: number;
  avg_resolution_time_hours: number | null;
  sla_compliance_pct: number | null;
  tickets: ReportTicketRow[];
}

export interface CustomReportResponse {
  generated_at: string;
  group_by: string;
  total_tickets: number;
  groups: CustomReportGroupRow[];
}

// Predefined Report Types
export interface PredefinedReportItem {
  label_da: string;
  count: number;
  metric_value: number;
  metric_label_da: string;
  percentage: number | null;
}

export interface PredefinedReportSection {
  title_da: string;
  description_da: string;
  metric_name_da: string;
  items: PredefinedReportItem[];
}

export interface PredefinedReportsResponse {
  generated_at: string;
  sections: PredefinedReportSection[];
}
