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
}
