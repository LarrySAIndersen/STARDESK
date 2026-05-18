import type { SlackChannel } from "@/types/slack";

/** Client fallback when channel API is unavailable (matches API mock catalog). */
export const MOCK_SLACK_CHANNELS: SlackChannel[] = [
  {
    channel_id: "C_MOCK_IT_SUPPORT",
    name: "it-support",
    display_name_da: "IT-support",
    is_private: false,
  },
  {
    channel_id: "C_MOCK_DRIFT",
    name: "drift",
    display_name_da: "Drift",
    is_private: false,
  },
  {
    channel_id: "C_MOCK_STAR_ALERTS",
    name: "star-alerts",
    display_name_da: "STAR-alerts",
    is_private: false,
  },
  {
    channel_id: "C_MOCK_MAJOR_INCIDENTS",
    name: "major-incidents",
    display_name_da: "Større hændelser",
    is_private: true,
  },
];
