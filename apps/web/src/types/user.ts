export type UserRole = "end_user" | "agent" | "admin" | "top_admin";

export interface User {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  role_label: string;
  organization_id?: string | null;
  organization_name?: string | null;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}
