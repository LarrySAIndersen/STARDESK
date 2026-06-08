export type UserRole = "end_user" | "agent" | "admin" | "top_admin" | "supporter" | "stardesk_reviewer" | "kundeportal_2";

export interface User {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  role_label: string;
  roles?: UserRole[];
  role_labels?: string[];
  organization_id?: string | null;
  organization_name?: string | null;
  must_change_password?: boolean;
  password_policy_exempt?: boolean;
  avatar_url?: string | null;
  avatar_preset_id?: string | null;
  /** When set, locks UI to classic or modern (overrides login cookie). */
  ui_mode?: "modern" | "classic" | null;
}

export type AvatarSelection =
  | { kind: "preset"; avatar_preset_id: string }
  | { kind: "upload"; avatar_url: string }
  | { kind: "none" };

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}
