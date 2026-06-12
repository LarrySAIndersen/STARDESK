import { afterEach, describe, expect, it, vi } from "vitest";

import { loadClassicBoardTickets } from "./classic-board-tickets";
import { apiGetServer } from "@/lib/api-server";
import type { Ticket } from "@/types/ticket";

vi.mock("@/lib/api-server", () => ({
  apiGetServer: vi.fn(),
}));

const mockedApiGetServer = vi.mocked(apiGetServer);

function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: "t1",
    ticket_number: "INC-1",
    title: "Board",
    status: "new",
    priority: "medium",
    ticket_type: "incident",
    is_major: false,
    sub_causes: [],
    created_at: "2026-06-10T10:00:00.000Z",
    ...overrides,
  };
}

describe("loadClassicBoardTickets", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns tickets from board API", async () => {
    const tickets = [makeTicket()];
    mockedApiGetServer.mockResolvedValue(tickets);
    await expect(loadClassicBoardTickets()).resolves.toEqual(tickets);
    expect(mockedApiGetServer).toHaveBeenCalledWith(
      "/api/v1/tickets?board=true&limit=500&open_only=true",
    );
  });

  it("returns empty array on API failure", async () => {
    mockedApiGetServer.mockRejectedValue(new Error("network"));
    await expect(loadClassicBoardTickets()).resolves.toEqual([]);
  });
});
