import { describe, expect, it } from "vitest";

import { buildAgentNavItems, filterNavItemsForViewer } from "@/lib/agent-nav";

describe("buildAgentNavItems", () => {
  it("includes projekter and team wiki for staff", () => {
    const items = buildAgentNavItems({ staff: true, showAdmin: false });
    const ids = items.map((item) => item.id);
    expect(ids).toContain("projekter");
    expect(ids).toContain("team-wiki");
    expect(ids).toContain("system-dokumentation");
    expect(ids).toContain("team-chat");
  });

  it("omits staff-only items for non-staff", () => {
    const items = buildAgentNavItems({ staff: false, showAdmin: false });
    const ids = items.map((item) => item.id);
    expect(ids).not.toContain("projekter");
    expect(ids).not.toContain("service-desk");
  });
});

describe("filterNavItemsForViewer", () => {
  it("hides nav ids for non-topadmin viewers", () => {
    const items = buildAgentNavItems({ staff: true, showAdmin: true });
    const filtered = filterNavItemsForViewer(items, ["projekter"], false);
    expect(filtered.map((item) => item.id)).not.toContain("projekter");
  });
});
