export interface TicketImportRowInput {
  title: string;
  description?: string;
  ticket_type?: string;
  priority?: string;
  status?: string;
  external_number?: string;
  category?: string;
  team?: string;
  reporter_email?: string;
  is_major?: string;
  source?: string;
}

export interface TicketImportRequest {
  rows: TicketImportRowInput[];
  default_ticket_type: "incident" | "service_request" | "problem";
  default_priority: "critical" | "high" | "medium" | "low";
  on_duplicate: "skip" | "update";
}

export interface TicketImportRowError {
  row: number;
  external_number?: string | null;
  message: string;
}

export interface TicketImportResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: TicketImportRowError[];
}
