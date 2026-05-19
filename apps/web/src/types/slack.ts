export interface SlackChannel {
  channel_id: string;
  name: string;
  display_name_da: string;
  is_private: boolean;
}

export interface SlackPushResponse {
  channel_id: string;
  channel_name: string;
  mock: boolean;
  message_ts?: string | null;
}

export interface SlackStatus {
  connected: boolean;
  enabled: boolean;
  team_id: string | null;
  team_name: string | null;
  default_channel_id: string | null;
  webhook_url: string | null;
  mode: "real" | "mock";
}

export interface SlackSettingsUpdateRequest {
  enabled?: boolean;
  default_channel_id?: string;
  webhook_url?: string;
}
