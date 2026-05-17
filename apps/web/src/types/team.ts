export interface TeamMember {
  user_id: string;
  display_name: string;
  email: string;
  role: string;
  role_label: string;
  joined_at: string;
}

export interface Team {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  members: TeamMember[];
}
