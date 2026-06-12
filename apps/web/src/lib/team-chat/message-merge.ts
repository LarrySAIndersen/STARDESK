import { dateKey, formatDateSeparator } from "@/lib/team-chat/message-format";
import type { TeamChatMessage } from "@/types/team-chat";

export function mergeTeamChatMessages(
  prev: TeamChatMessage[],
  incoming: TeamChatMessage[],
): TeamChatMessage[] {
  const map = new Map(prev.map((m) => [m.id, m]));
  for (const m of incoming) {
    map.set(m.id, m);
  }
  return [...map.values()].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

export type TeamChatListItem =
  | { type: "separator"; key: string; label: string }
  | { type: "message"; key: string; message: TeamChatMessage };

export function buildTeamChatMessageListItems(messages: TeamChatMessage[]): TeamChatListItem[] {
  const items: TeamChatListItem[] = [];
  let lastDay: string | null = null;

  for (const message of messages) {
    const day = dateKey(message.created_at);
    if (day !== lastDay) {
      items.push({
        type: "separator",
        key: `sep-${day}`,
        label: formatDateSeparator(message.created_at),
      });
      lastDay = day;
    }
    items.push({ type: "message", key: message.id, message });
  }

  return items;
}
