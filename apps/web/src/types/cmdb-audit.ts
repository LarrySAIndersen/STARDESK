export type CmdbAuditAction =
  | "create"
  | "update"
  | "delete"
  | "connection_add"
  | "connection_remove";

export type CmdbEntityType = "system" | "subsystem" | "edge";

export interface CmdbAuditEntry {
  id: string;
  created_at: string;
  actor_user_id: string | null;
  actor_display_name: string;
  action: CmdbAuditAction;
  entity_type: CmdbEntityType;
  entity_id: string;
  entity_label: string;
  changes: Record<string, unknown>;
  summary_da: string;
}

export interface CmdbAuditLogPage {
  items: CmdbAuditEntry[];
  has_more: boolean;
  next_before_id: string | null;
  approx_bytes: number;
}

export interface CmdbAuditCreatePayload {
  action: CmdbAuditAction;
  entity_type: CmdbEntityType;
  entity_id: string;
  entity_label?: string;
  changes?: Record<string, unknown>;
  summary_da?: string;
}
