import { describe, expect, it } from "vitest";

import {
  matchesTeamChatChannelQuery,
  pickDefaultTeamChatChannel,
  splitTeamChatChannels,
  teamChatChannelLabel,
  teamChatThreadSubtitle,
  teamChatThreadTitle,
} from "@/lib/team-chat/channel-utils";
import type { TeamChatChannel } from "@/types/team-chat";

function channel(partial: Partial<TeamChatChannel> & Pick<TeamChatChannel, "id">): TeamChatChannel {
  return {
    id: partial.id,
    name: partial.name ?? "Kanal",
    slug: partial.slug ?? "kanal",
    channel_type: partial.channel_type ?? "public",
    is_private: partial.is_private ?? false,
    is_system: partial.is_system ?? false,
    description: partial.description ?? null,
    unread_count: partial.unread_count ?? 0,
    last_message_preview: partial.last_message_preview ?? null,
    last_message_at: partial.last_message_at ?? null,
  };
}

describe("team-chat channel-utils", () => {
  it("labels dm, bot, and public channels", () => {
    expect(teamChatChannelLabel(channel({ id: "1", channel_type: "dm", name: "Anna" }))).toBe(
      "Anna",
    );
    expect(teamChatChannelLabel(channel({ id: "2", slug: "general" }))).toBe("general");
  });

  it("filters channels by search query", () => {
    const channels = [
      channel({ id: "1", slug: "general", description: "Fælles" }),
      channel({ id: "2", slug: "random" }),
    ];
    expect(matchesTeamChatChannelQuery(channels[0], "fælles")).toBe(true);
    expect(matchesTeamChatChannelQuery(channels[1], "general")).toBe(false);
  });

  it("splits channel groups", () => {
    const channels = [
      channel({ id: "1", channel_type: "public", slug: "general" }),
      channel({ id: "2", channel_type: "dm", name: "Anna" }),
      channel({ id: "3", channel_type: "private", slug: "ops" }),
      channel({ id: "4", channel_type: "bot", name: "Help-a-bot" }),
    ];
    const split = splitTeamChatChannels(channels);
    expect(split.publicChannels.map((c) => c.id)).toEqual(["1", "4"]);
    expect(split.dmChannels.map((c) => c.id)).toEqual(["2"]);
    expect(split.privateChannels.map((c) => c.id)).toEqual(["3"]);
  });

  it("picks general channel by default", () => {
    const channels = [
      channel({ id: "1", slug: "random" }),
      channel({ id: "2", slug: "general" }),
    ];
    expect(pickDefaultTeamChatChannel(channels)?.id).toBe("2");
  });

  it("formats thread title and subtitle", () => {
    expect(teamChatThreadTitle(null)).toBe("STARchat");
    expect(
      teamChatThreadTitle(channel({ id: "1", slug: "general", name: "General" })),
    ).toBe("#general");
    expect(
      teamChatThreadSubtitle(channel({ id: "2", channel_type: "bot", name: "Bot" })),
    ).toBe("AI-assistent til intern support");
  });
});
