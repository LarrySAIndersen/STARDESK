import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Kp2CaseRow } from "@/lib/kundeportal-2/types";
import type { Ticket } from "@/types/ticket";

const apiGetMock = vi.fn();

vi.mock("@/lib/api", () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
}));

import {
  fetchKp2Cases,
  isKp2CaseActive,
  ticketToKp2CaseRow,
} from "@/lib/kundeportal-2/cases-api";

function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: "ticket-1",
    ticket_number: "INC-1001",
    title: "Test sag",
    status: "in_progress",
    priority: "medium",
    ticket_type: "incident",
    is_major: false,
    sub_causes: [],
    created_at: "2026-06-10T10:00:00.000Z",
    reporter_display_name: "Anna Agent",
    reporter_user_id: "user-1",
    ...overrides,
  };
}

describe("ticketToKp2CaseRow", () => {
  it("maps ticket fields to KP2 case row", () => {
    const row = ticketToKp2CaseRow(makeTicket());
    expect(row).toEqual({
      id: "ticket-1",
      number: "INC-1001",
      title: "Test sag",
      type: "incident",
      status: "in_progress",
      priority: "medium",
      createdAt: "2026-06-10T10:00:00.000Z",
      requester: "Anna Agent",
      reporterUserId: "user-1",
    });
  });

  it("maps change and service_request types", () => {
    expect(ticketToKp2CaseRow(makeTicket({ ticket_type: "change" })).type).toBe("change");
    expect(ticketToKp2CaseRow(makeTicket({ ticket_type: "service_request" })).type).toBe(
      "service_request",
    );
  });

  it("falls back requester to Ukendt when display name is missing", () => {
    expect(
      ticketToKp2CaseRow(makeTicket({ reporter_display_name: undefined })).requester,
    ).toBe("Ukendt");
  });
});

describe("isKp2CaseActive", () => {
  const activeRow: Kp2CaseRow = {
    id: "1",
    number: "INC-1",
    title: "Aktiv",
    type: "incident",
    status: "in_progress",
    priority: "medium",
    createdAt: "2026-06-10T10:00:00.000Z",
    requester: "Test",
    reporterUserId: "u1",
  };

  it("returns true for open statuses", () => {
    expect(isKp2CaseActive(activeRow)).toBe(true);
  });

  it("returns false for closed statuses", () => {
    for (const status of ["resolved", "closed", "cancelled"] as const) {
      expect(isKp2CaseActive({ ...activeRow, status })).toBe(false);
    }
  });
});

describe("fetchKp2Cases", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
  });

  it("filters out major tickets and maps rows", async () => {
    apiGetMock.mockResolvedValue([
      makeTicket({ id: "t1", is_major: false }),
      makeTicket({ id: "t2", is_major: true, title: "Major" }),
    ]);

    const rows = await fetchKp2Cases();

    expect(apiGetMock).toHaveBeenCalledWith("/api/v1/tickets?limit=500&sort=created_desc");
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("t1");
  });
});
