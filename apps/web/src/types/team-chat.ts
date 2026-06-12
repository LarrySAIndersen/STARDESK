export type TeamChatChannel = Readonly<{
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_private: boolean;
  is_system: boolean;
  channel_type: "public" | "private" | "dm" | "bot";
  unread_count: number;
  last_message_at: string | null;
  last_message_preview: string | null;
}>;

export type TeamChatReaction = Readonly<{
  emoji: string;
  count: number;
  reacted_by_me: boolean;
}>;

export type TeamChatMessage = Readonly<{
  id: string;
  channel_id: string;
  sender_user_id: string | null;
  sender_display_name: string;
  body: string;
  is_bot: boolean;
  is_own: boolean;
  tool_call_meta: Record<string, unknown> | null;
  reactions: TeamChatReaction[];
  created_at: string;
}>;

export type TeamChatStaff = Readonly<{
  id: string;
  display_name: string;
  email: string;
}>;
