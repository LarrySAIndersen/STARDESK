import type { TeamChatMessage } from "@/types/team-chat";

export type PersonalMentionKind = "mention" | "participant" | "invited";

export type PersonalMentionItem = Readonly<{
  kind: PersonalMentionKind;
  ticket_id: string;
  ticket_number: string;
  ticket_title: string;
  channel_id: string | null;
  subtitle: string;
  last_activity_at: string;
  invited_by_me: boolean;
}>;

export type PersonalMentionsOverview = Readonly<{
  items: PersonalMentionItem[];
}>;

export type TicketInternalChat = Readonly<{
  ticket_id: string;
  ticket_number: string;
  channel_id: string | null;
  messages: TeamChatMessage[];
}>;

export const MENTIONS_OVERVIEW_CHANGED_EVENT = "stardesk-mentions-overview-changed";

export function dispatchMentionsOverviewChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(MENTIONS_OVERVIEW_CHANGED_EVENT));
}
