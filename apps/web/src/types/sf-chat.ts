export type SfChatStatus = {
  open: boolean;
  available_agents: number;
  message: string;
};

export type SfChatSession = {
  id: string;
  status: string;
  assigned_agent_id: string | null;
  assigned_agent_name: string | null;
  created_at: string;
  updated_at: string;
  queue_message: string | null;
};

export type SfChatMessage = {
  id: string;
  session_id: string;
  sender_user_id: string;
  sender_display_name: string;
  body: string;
  created_at: string;
  is_own: boolean;
};

export type SfChatPresence = {
  is_online: boolean;
  is_sf_member: boolean;
  active_session_id: string | null;
  last_seen_at: string | null;
};

export type SfChatLogoutCheck = {
  can_logout: boolean;
  reason: string | null;
  waiting_sessions: number;
  active_sessions: number;
};

export type SfChatAgentInboxItem = {
  session: SfChatSession;
  customer_display_name: string;
  customer_email: string;
  last_message_preview: string | null;
  last_message_at: string | null;
  unread_count: number;
  customer_is_typing: boolean;
};

export type SfChatAgentInbox = {
  items: SfChatAgentInboxItem[];
  online: boolean;
  notification_count: number;
};
