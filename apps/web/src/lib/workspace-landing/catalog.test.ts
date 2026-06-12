import { describe, expect, it } from "vitest";

import {
  DEFAULT_WORKSPACE_LANDING,
  definitionForKind,
  nextWidgetOrder,
  widgetsForSpace,
  WORKSPACE_WIDGET_CATALOG,
} from "@/lib/workspace-landing/catalog";

describe("workspace landing catalog", () => {
  it("lists personal and team widgets separately", () => {
    expect(widgetsForSpace("personal").every((w) => w.space === "personal")).toBe(true);
    expect(widgetsForSpace("team").every((w) => w.space === "team")).toBe(true);
    expect(WORKSPACE_WIDGET_CATALOG.length).toBe(
      widgetsForSpace("personal").length + widgetsForSpace("team").length,
    );
  });

  it("returns definition for known widget kinds", () => {
    expect(definitionForKind("team-chat").label).toBe("Teamchat");
  });

  it("throws for unknown widget kinds", () => {
    expect(() => definitionForKind("unknown" as never)).toThrow(/Unknown workspace widget kind/);
  });

  it("computes next widget order", () => {
    expect(nextWidgetOrder([])).toBe(0);
    expect(nextWidgetOrder(DEFAULT_WORKSPACE_LANDING.personal)).toBe(5);
  });

  it("ships default layouts for both spaces", () => {
    expect(DEFAULT_WORKSPACE_LANDING.personal.length).toBeGreaterThan(0);
    expect(DEFAULT_WORKSPACE_LANDING.team.length).toBeGreaterThan(0);
  });
});
