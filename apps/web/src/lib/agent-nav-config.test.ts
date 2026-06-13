import { describe, expect, it } from "vitest";

import { buildAgentNavItems } from "@/lib/agent-nav";
import {
  NAV_LAYOUT_VERSION,
  buildDefaultNavLayout,
  sanitizeNavLayout,
} from "@/lib/agent-nav-config";

describe("sanitizeNavLayout", () => {
  it("inserts new nav items near their default position, not at the end", () => {
    const items = buildAgentNavItems({
      staff: true,
      showAdmin: true,
      showForbedringer: true,
    });
    const defaultLayout = buildDefaultNavLayout(items, { includeClassicUi: false });
    const availableIds = new Set(defaultLayout.entries.map((entry) => entry.id));

    const savedWithoutSystemDocs = {
      version: NAV_LAYOUT_VERSION,
      entries: defaultLayout.entries.filter((entry) => entry.id !== "system-dokumentation"),
    };

    const merged = sanitizeNavLayout(savedWithoutSystemDocs, defaultLayout, availableIds);
    const ids = merged.entries.map((entry) => entry.id);
    const teamWikiIndex = ids.indexOf("team-wiki");
    const systemDocsIndex = ids.indexOf("system-dokumentation");
    const groupsIndex = ids.indexOf("groups");

    expect(systemDocsIndex).toBeGreaterThan(teamWikiIndex);
    expect(systemDocsIndex).toBeLessThan(groupsIndex);
  });
});
