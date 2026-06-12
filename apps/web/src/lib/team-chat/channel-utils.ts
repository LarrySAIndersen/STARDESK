import type { TeamChatChannel } from "@/types/team-chat";

export function teamChatChannelLabel(ch: TeamChatChannel): string {
  if (ch.channel_type === "dm" || ch.channel_type === "bot") {
    return ch.name;
  }
  return ch.slug;
}

export function matchesTeamChatChannelQuery(ch: TeamChatChannel, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    teamChatChannelLabel(ch).toLowerCase().includes(q) ||
    (ch.description?.toLowerCase().includes(q) ?? false)
  );
}

export function splitTeamChatChannels(channels: TeamChatChannel[], search = "") {
  const publicChannels = channels.filter(
    (c) =>
      (c.channel_type === "public" || c.channel_type === "bot") &&
      matchesTeamChatChannelQuery(c, search),
  );
  const dmChannels = channels.filter(
    (c) => c.channel_type === "dm" && matchesTeamChatChannelQuery(c, search),
  );
  const privateChannels = channels.filter(
    (c) => c.channel_type === "private" && matchesTeamChatChannelQuery(c, search),
  );
  return { publicChannels, dmChannels, privateChannels };
}

export function pickDefaultTeamChatChannel(channels: TeamChatChannel[]): TeamChatChannel | null {
  if (channels.length === 0) return null;
  return channels.find((c) => c.slug === "general") ?? channels[0];
}

export function teamChatThreadTitle(channel: TeamChatChannel | null): string {
  if (!channel) return "STARchat";
  const isDm = channel.channel_type === "dm";
  const isBot = channel.channel_type === "bot";
  return isDm || isBot ? channel.name : `#${channel.slug}`;
}

export function teamChatThreadSubtitle(channel: TeamChatChannel | null): string {
  if (!channel) return "Intern team-chat";
  const isDm = channel.channel_type === "dm";
  const isBot = channel.channel_type === "bot";
  if (channel.description) return channel.description;
  if (isBot) return "AI-assistent til intern support";
  if (isDm) return "Direkte besked";
  return channel.is_private ? "Privat kanal" : "Offentlig kanal";
}
