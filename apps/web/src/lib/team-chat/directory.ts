import { apiGet } from "@/lib/api";
import type { TeamChatChannel, TeamChatStaff } from "@/types/team-chat";

export async function loadTeamChatChannels(): Promise<TeamChatChannel[]> {
  return apiGet<TeamChatChannel[]>("/api/v1/team-chat/channels");
}

export async function loadTeamChatStaff(): Promise<TeamChatStaff[]> {
  return apiGet<TeamChatStaff[]>("/api/v1/team-chat/staff");
}

export async function loadTeamChatDirectory(): Promise<{
  channels: TeamChatChannel[];
  staff: TeamChatStaff[];
}> {
  const [channels, staff] = await Promise.all([loadTeamChatChannels(), loadTeamChatStaff()]);
  return { channels, staff };
}
