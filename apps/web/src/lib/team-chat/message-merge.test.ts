import { describe, expect, it } from "vitest";

import {
  buildTeamChatMessageListItems,
  mergeTeamChatMessages,
} from "@/lib/team-chat/message-merge";
import type { TeamChatMessage } from "@/types/team-chat";

function message(partial: Partial<TeamChatMessage> & Pick<TeamChatMessage, "id">): TeamChatMessage {
  return {
    id: partial.id,
    channel_id: partial.channel_id ?? "ch-1",
    body: partial.body ?? "Hej",
    created_at: partial.created_at ?? "2026-06-12T10:00:00.000Z",
    sender_display_name: partial.sender_display_name ?? "Anna",
    sender_user_id: partial.sender_user_id ?? "u1",
    is_own: partial.is_own ?? false,
    is_bot: partial.is_bot ?? false,
    reactions: partial.reactions ?? [],
    tool_call_meta: partial.tool_call_meta ?? null,
  };
}

describe("team-chat message-merge", () => {
  it("merges and sorts messages by timestamp", () => {
    const merged = mergeTeamChatMessages(
      [message({ id: "a", created_at: "2026-06-12T10:00:00.000Z" })],
      [message({ id: "b", created_at: "2026-06-12T11:00:00.000Z" })],
    );
    expect(merged.map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("overwrites duplicate ids with incoming payload", () => {
    const merged = mergeTeamChatMessages(
      [message({ id: "a", body: "old" })],
      [message({ id: "a", body: "new" })],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].body).toBe("new");
  });

  it("builds list items with date separators", () => {
    const items = buildTeamChatMessageListItems([
      message({ id: "1", created_at: "2026-06-11T10:00:00.000Z" }),
      message({ id: "2", created_at: "2026-06-12T10:00:00.000Z" }),
    ]);
    expect(items.filter((i) => i.type === "separator")).toHaveLength(2);
    expect(items.filter((i) => i.type === "message")).toHaveLength(2);
  });
});
