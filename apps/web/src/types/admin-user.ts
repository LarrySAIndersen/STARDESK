export interface UserTeamSummary {
  id: string;
  name: string;
}

export interface UserAdminListItem {
  id: string;
  email: string;
  display_name: string;
  role: string;
  role_label: string;
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
  is_active: boolean;
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
  role?: string;
  is_active?: boolean;
  organization_id?: string | null;
  team_ids?: string[];
}

export interface UserAdminCreateInput {
  email: string;
  display_name: string;
  role: string;
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
