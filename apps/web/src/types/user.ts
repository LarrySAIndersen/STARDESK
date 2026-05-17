export type UserRole = "end_user" | "agent" | "admin";

export interface User {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  role_label: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}
