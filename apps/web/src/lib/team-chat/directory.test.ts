import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiGet } from "@/lib/api";
import {
  loadTeamChatChannels,
  loadTeamChatDirectory,
  loadTeamChatStaff,
} from "@/lib/team-chat/directory";

vi.mock("@/lib/api", () => ({
  apiGet: vi.fn(),
}));

describe("team chat directory loaders", () => {
  beforeEach(() => {
    vi.mocked(apiGet).mockReset();
  });

  it("loads channels", async () => {
    vi.mocked(apiGet).mockResolvedValueOnce([{ id: "1", slug: "general" }]);
    await expect(loadTeamChatChannels()).resolves.toEqual([{ id: "1", slug: "general" }]);
    expect(apiGet).toHaveBeenCalledWith("/api/v1/team-chat/channels");
  });

  it("loads staff", async () => {
    vi.mocked(apiGet).mockResolvedValueOnce([{ id: "u1", display_name: "Anna", email: "a@x.dk" }]);
    await expect(loadTeamChatStaff()).resolves.toHaveLength(1);
    expect(apiGet).toHaveBeenCalledWith("/api/v1/team-chat/staff");
  });

  it("loads channels and staff together", async () => {
    vi.mocked(apiGet)
      .mockResolvedValueOnce([{ id: "c1" }])
      .mockResolvedValueOnce([{ id: "s1" }]);
    await expect(loadTeamChatDirectory()).resolves.toEqual({
      channels: [{ id: "c1" }],
      staff: [{ id: "s1" }],
    });
  });
});
