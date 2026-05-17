export interface LongestOpenTicket {
  id: string;
  ticket_number: string;
  title: string;
  status: string;
  status_label_da: string;
  days_open: number;
  hours_open: number;
  created_at: string;
  assigned_team_name: string | null;
  priority: string;
}

export interface CountByLabel {
  key: string;
  label_da: string;
  count: number;
}

export interface DailyCount {
  date: string;
  count: number;
}

export interface OperationsDashboard {
  generated_at: string;
  open_count: number;
  closed_count: number;
  major_open_count: number;
  sla_overdue_count: number;
  sla_due_soon_count: number;
  opened_last_7_days: number;
  closed_last_7_days: number;
  avg_open_age_days: number | null;
  resolution_rate_pct: number;
  longest_open: LongestOpenTicket | null;
  status_breakdown: CountByLabel[];
  priority_breakdown: CountByLabel[];
  bucket_counts: CountByLabel[];
  daily_created: DailyCount[];
  daily_closed: DailyCount[];
}
