import { describe, expect, it } from "vitest";

import {
  filterTicketsForAsset,
  resolveAssetRecord,
  ticketMatchesAsset,
} from "./asset-tickets";
import type { AssetSystem } from "@/types/asset";
import type { Ticket } from "@/types/ticket";

const systems: AssetSystem[] = [
  {
    id: "sys-crm",
    name: "CRM",
    code: "CRM",
    subsystems: [{ id: "sub-mail", system_id: "sys-crm", name: "Mail Gateway", code: "MAIL" }],
  },
];

function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: "t1",
    ticket_number: "INC-1",
    title: "Mail gateway nede",
    status: "new",
    priority: "medium",
    ticket_type: "incident",
    is_major: false,
    sub_causes: [],
    created_at: "2026-06-10T10:00:00.000Z",
    ...overrides,
  };
}

describe("resolveAssetRecord", () => {
  it("resolves system and subsystem records", () => {
    expect(resolveAssetRecord("sys-crm", systems)).toMatchObject({ code: "CRM" });
    expect(resolveAssetRecord("sub-mail", systems)).toMatchObject({
      code: "MAIL",
      systemName: "CRM",
    });
    expect(resolveAssetRecord("missing", systems)).toBeNull();
  });
});

describe("ticketMatchesAsset", () => {
  it("matches tags and text tokens", () => {
    expect(
      ticketMatchesAsset(makeTicket({ tags: ["asset:sys-crm"] }), "sys-crm", systems),
    ).toBe(true);
    expect(ticketMatchesAsset(makeTicket({ title: "CRM sync fejl" }), "sys-crm", systems)).toBe(
      true,
    );
    expect(ticketMatchesAsset(makeTicket({ title: "Printer" }), "sys-crm", systems)).toBe(false);
  });
});

describe("filterTicketsForAsset", () => {
  it("filters ticket list for asset", () => {
    const tickets = [
      makeTicket({ id: "match", tags: ["aktiv:MAIL"] }),
      makeTicket({ id: "other", title: "HR sag" }),
    ];
    expect(filterTicketsForAsset(tickets, "sub-mail", systems).map((t) => t.id)).toEqual([
      "match",
    ]);
  });
});
