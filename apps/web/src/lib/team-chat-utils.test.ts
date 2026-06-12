import { describe, expect, it } from "vitest";

import type { TeamChatChannel, TeamChatMessage } from "@/types/team-chat";

import {
  buildTeamChatMessagesUrl,
  buildTeamChatPollUrl,
  formatTeamChatTime,
  mergeTeamChatMessages,
  partitionTeamChatChannels,
  pickDefaultTeamChatChannel,
  readTeamChatOpenFromStorage,
  teamChatChannelLabel,
} from "@/lib/team-chat-utils";

const baseChannel = (overrides: Partial<TeamChatChannel>): TeamChatChannel => ({
  id: "ch-1",
  name: "general",
  slug: "general",
  description: null,
  is_private: false,
  is_system: true,
  channel_type: "public",
  unread_count: 0,
  last_message_at: null,
  last_message_preview: null,
  ...overrides,
});

const baseMessage = (overrides: Partial<TeamChatMessage>): TeamChatMessage => ({
  id: "m-1",
  channel_id: "ch-1",
  sender_user_id: "u-1",
  sender_display_name: "Anna",
  body: "Hej",
  is_bot: false,
  is_own: true,
  tool_call_meta: null,
  reactions: [],
  created_at: "2026-06-12T10:00:00.000Z",
  ...overrides,
});

describe("team-chat-utils", () => {
  it("formatTeamChatTime returns HH:MM", () => {
    expect(formatTeamChatTime("2026-06-12T14:05:00.000Z")).toMatch(/^\d{2}:\d{2}$/);
  });

  it("mergeTeamChatMessages deduplicates and sorts by created_at", () => {
    const a = baseMessage({ id: "m-1", created_at: "2026-06-12T10:00:00.000Z" });
    const b = baseMessage({ id: "m-2", created_at: "2026-06-12T11:00:00.000Z" });
    const updated = baseMessage({
      id: "m-1",
      body: "Opdateret",
      created_at: "2026-06-12T10:00:00.000Z",
    });
    const merged = mergeTeamChatMessages([a, b], [updated]);
    expect(merged).toHaveLength(2);
    expect(merged[0].body).toBe("Opdateret");
    expect(merged[1].id).toBe("m-2");
  });

  it("partitionTeamChatChannels splits by type", () => {
    const channels = [
      baseChannel({ id: "1", channel_type: "public" }),
      baseChannel({ id: "2", channel_type: "bot", slug: "help-a-bot" }),
      baseChannel({ id: "3", channel_type: "private", is_private: true }),
      baseChannel({ id: "4", channel_type: "dm", name: "Lars" }),
    ];
    const parts = partitionTeamChatChannels(channels);
    expect(parts.publicChannels).toHaveLength(2);
    expect(parts.privateChannels).toHaveLength(1);
    expect(parts.dmChannels).toHaveLength(1);
  });

  it("pickDefaultTeamChatChannel prefers general", () => {
    const channels = [
      baseChannel({ id: "x", slug: "it-support" }),
      baseChannel({ id: "g", slug: "general" }),
    ];
    expect(pickDefaultTeamChatChannel(channels)?.id).toBe("g");
  });

  it("pickDefaultTeamChatChannel respects active id", () => {
    const channels = [
      baseChannel({ id: "x", slug: "it-support" }),
      baseChannel({ id: "g", slug: "general" }),
    ];
    expect(pickDefaultTeamChatChannel(channels, "x")?.id).toBe("x");
  });

  it("teamChatChannelLabel uses slug for public channels", () => {
    expect(teamChatChannelLabel(baseChannel({ channel_type: "public", slug: "general" }))).toBe(
      "general",
    );
    expect(
      teamChatChannelLabel(baseChannel({ channel_type: "dm", name: "Lars", slug: "dm-x" })),
    ).toBe("Lars");
  });

  it("buildTeamChatMessagesUrl encodes after query", () => {
    expect(buildTeamChatMessagesUrl("abc")).toBe("/api/v1/team-chat/channels/abc/messages");
    expect(buildTeamChatMessagesUrl("abc", "2026-06-12T10:00:00Z")).toContain("after=");
  });

  it("buildTeamChatPollUrl encodes after query", () => {
    expect(buildTeamChatPollUrl("abc")).toBe("/api/v1/team-chat/channels/abc/poll");
    expect(buildTeamChatPollUrl("abc", "2026-06-12T10:00:00Z")).toContain("after=");
  });

  it("readTeamChatOpenFromStorage reads persisted flag", () => {
    expect(readTeamChatOpenFromStorage("true")).toBe(true);
    expect(readTeamChatOpenFromStorage("false")).toBe(false);
    expect(readTeamChatOpenFromStorage(null)).toBe(false);
  });
});
