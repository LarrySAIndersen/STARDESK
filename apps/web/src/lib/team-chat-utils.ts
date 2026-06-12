import type { TeamChatChannel, TeamChatMessage } from "@/types/team-chat";

export function formatTeamChatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

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

export function partitionTeamChatChannels(channels: TeamChatChannel[]): Readonly<{
  publicChannels: TeamChatChannel[];
  privateChannels: TeamChatChannel[];
  dmChannels: TeamChatChannel[];
}> {
  return {
    publicChannels: channels.filter(
      (c) => c.channel_type === "public" || c.channel_type === "bot",
    ),
    privateChannels: channels.filter((c) => c.channel_type === "private"),
    dmChannels: channels.filter((c) => c.channel_type === "dm"),
  };
}

export function pickDefaultTeamChatChannel(
  channels: TeamChatChannel[],
  activeChannelId?: string | null,
): TeamChatChannel | null {
  if (activeChannelId) {
    return channels.find((c) => c.id === activeChannelId) ?? null;
  }
  if (channels.length === 0) return null;
  return channels.find((c) => c.slug === "general") ?? channels[0];
}

export function teamChatChannelLabel(ch: TeamChatChannel): string {
  if (ch.channel_type === "dm" || ch.channel_type === "bot") return ch.name;
  return ch.slug;
}

export function buildTeamChatMessagesUrl(channelId: string, after?: string | null): string {
  const qs = after ? `?after=${encodeURIComponent(after)}` : "";
  return `/api/v1/team-chat/channels/${channelId}/messages${qs}`;
}

export function buildTeamChatPollUrl(channelId: string, after?: string | null): string {
  const qs = after ? `?after=${encodeURIComponent(after)}` : "";
  return `/api/v1/team-chat/channels/${channelId}/poll${qs}`;
}

export function readTeamChatOpenFromStorage(value: string | null): boolean {
  return value === "true";
}
