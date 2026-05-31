import type { Ticket } from "@/types/ticket";
import type { UserRole } from "@/types/user";

export interface UserTeamSummary {
  id: string;
  name: string;
}

export interface UserTicketsGrouped {
  reported: Ticket[];
  assigned: Ticket[];
  affected: Ticket[];
  interested: Ticket[];
  mentioned: Ticket[];
}

export interface UserAdminListItem {
  id: string;
  email: string;
  display_name: string;
  role: string;
  role_label: string;
  roles: UserRole[];
  role_labels: string[];
  is_active: boolean;
  organization_name: string | null;
  team_ids: string[];
  team_names: string[];
}

export interface UserAdminListResponse {
  items: UserAdminListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface UserAdminRead {
  id: string;
  email: string;
  display_name: string;
  role: string;
  role_label: string;
  roles: UserRole[];
  role_labels: string[];
  is_active: boolean;
  password_policy_exempt: boolean;
  organization_id: string | null;
  organization_name: string | null;
  teams: UserTeamSummary[];
  created_at: string | null;
}

export interface RoleOption {
  value: string;
  label: string;
}

export interface OrganizationOption {
  id: string;
  name: string;
}

export interface UserAdminMeta {
  roles: RoleOption[];
  organizations: OrganizationOption[];
}

export interface UserAdminUpdateInput {
  display_name?: string;
  email?: string;
  roles?: UserRole[];
  is_active?: boolean;
  organization_id?: string | null;
  team_ids?: string[];
  password_policy_exempt?: boolean;
}

export interface UserAdminCreateInput {
  email: string;
  display_name: string;
  roles: UserRole[];
  is_active: boolean;
  organization_id: string | null;
  team_ids: string[];
  initial_password?: string;
  clone_from_user_id?: string | null;
}

export interface UserAdminCreated {
  user: UserAdminRead;
  temporary_password: string | null;
}

export interface UserImportRowInput {
  email: string;
  display_name: string;
  role?: string;
  is_active?: string;
  teams?: string;
  organization?: string;
}

export interface UserImportRequest {
  rows: UserImportRowInput[];
  default_role: "end_user" | "agent" | "admin" | "top_admin";
  on_duplicate: "skip" | "update";
}

export interface UserImportRowError {
  row: number;
  email: string | null;
  message: string;
}

export interface UserImportResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: UserImportRowError[];
}
