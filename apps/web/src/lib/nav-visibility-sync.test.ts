import { describe, expect, it } from "vitest";

import { buildAgentNavItems } from "@/lib/agent-nav";
import { INTEGRATION_META } from "@/lib/integrations-config";
import {
  EXTERNAL_NAV_VISIBILITY_IDS,
  NAV_VISIBILITY_PATH_BY_ID,
} from "@/lib/nav-visibility-registry";

/** Nav ids that render a visibility eye for top-admin (sidebar + home sitemap extras). */
function collectEyeManagedNavIds(): string[] {
  const items = buildAgentNavItems({
    staff: true,
    showAdmin: true,
    showForbedringer: true,
  });
  return [
    ...items.map((item) => item.id),
    ...INTEGRATION_META.map((meta) => `integration-${meta.id}`),
    "arbejdsrum",
  ];
}

describe("nav visibility registry sync", () => {
  it("maps every eye-managed nav id to a path", () => {
    const ids = collectEyeManagedNavIds();
    const unique = [...new Set(ids)];

    for (const navId of unique) {
      expect(
        NAV_VISIBILITY_PATH_BY_ID[navId],
        `missing NAV_VISIBILITY_PATH_BY_ID entry for ${navId}`,
      ).toBeDefined();
    }
  });

  it("matches buildAgentNavItems hrefs for internal routes", () => {
    const items = buildAgentNavItems({
      staff: true,
      showAdmin: true,
      showForbedringer: true,
    });

    for (const item of items) {
      if (EXTERNAL_NAV_VISIBILITY_IDS.has(item.id)) {
        continue;
      }
      if (item.href.startsWith("http://") || item.href.startsWith("https://")) {
        continue;
      }
      expect(NAV_VISIBILITY_PATH_BY_ID[item.id]).toBe(item.href);
    }
  });

  it("includes legacy min-side for API persistence", () => {
    expect(NAV_VISIBILITY_PATH_BY_ID["min-side"]).toBe("/min-side");
  });
});
