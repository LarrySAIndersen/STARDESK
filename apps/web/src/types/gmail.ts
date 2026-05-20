export interface GmailStatus {
  connected: boolean;
  enabled: boolean;
  connected_email: string | null;
  last_history_id: string | null;
  last_sync_at: string | null;
  mode: "real" | "mock";
}

export interface GmailSyncResult {
  processed: number;
  created_tickets: number;
  appended_to_threads: number;
  skipped_duplicates: number;
  mode: "real" | "mock";
}

export interface GmailTestResult {
  ok: boolean;
  connected_email: string | null;
  detail: string;
}
