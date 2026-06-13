import { describe, expect, it } from "vitest";

import {
  filterProjekterHubItems,
  PROJEKTER_HUB_ITEMS,
} from "@/lib/projekter-hub";

describe("projekter-hub", () => {
  it("lists core project tools", () => {
    const labels = PROJEKTER_HUB_ITEMS.map((item) => item.label);
    expect(labels).toContain("Kanban");
    expect(labels).toContain("Backlog");
    expect(labels).toContain("Alle sager");
  });

  it("filters by label", () => {
    const filtered = filterProjekterHubItems("kanban");
    expect(filtered.map((item) => item.id)).toEqual(["kanban"]);
  });

  it("returns all items for empty query", () => {
    expect(filterProjekterHubItems("")).toHaveLength(PROJEKTER_HUB_ITEMS.length);
  });
});
