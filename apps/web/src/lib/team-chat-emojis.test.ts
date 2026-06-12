import { describe, expect, it } from "vitest";

import { ALL_EMOJIS, EMOJI_CATEGORIES, filterEmojis } from "@/lib/team-chat-emojis";

describe("team-chat-emojis", () => {
  it("exports categories with emojis", () => {
    expect(Object.keys(EMOJI_CATEGORIES).length).toBeGreaterThan(3);
    expect(ALL_EMOJIS.length).toBeGreaterThan(50);
  });

  it("filterEmojis returns all when query empty", () => {
    expect(filterEmojis("")).toEqual(ALL_EMOJIS);
  });

  it("filterEmojis returns all for any query (prototype)", () => {
    expect(filterEmojis("smile")).toEqual(ALL_EMOJIS);
  });
});
