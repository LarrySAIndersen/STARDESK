import { describe, expect, it } from "vitest";

import { WORKSPACE_WIDGET_CATALOG } from "@/lib/workspace-landing/catalog";
import { SPACE_VISUALS, WIDGET_VISUALS, visualForKind } from "@/lib/workspace-landing/sitemap-visuals";

describe("sitemap visuals", () => {
  it("defines visuals for every catalog widget kind", () => {
    for (const widget of WORKSPACE_WIDGET_CATALOG) {
      const visual = visualForKind(widget.kind);
      expect(visual.icon).toBeDefined();
      expect(visual.accent).toMatch(/^#/);
      expect(visual.nodeLabel.length).toBeGreaterThan(0);
      expect(WIDGET_VISUALS[widget.kind]).toBe(visual);
    }
  });

  it("defines space gradients for personal and team", () => {
    expect(SPACE_VISUALS.personal.label).toBe("Eget space");
    expect(SPACE_VISUALS.team.label).toBe("Team space");
    expect(SPACE_VISUALS.personal.gradient).toContain("linear-gradient");
  });
});
