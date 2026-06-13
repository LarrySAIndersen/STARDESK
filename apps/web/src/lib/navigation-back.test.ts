import { describe, expect, it } from "vitest";

import {
  navigationBackFallback,
  shouldShowNavigationBack,
} from "@/lib/navigation-back";

describe("navigationBackFallback", () => {
  it("returns home for staff routes", () => {
    expect(navigationBackFallback("/tickets")).toBe("/");
    expect(navigationBackFallback("/tickets/abc/overview")).toBe("/");
  });

  it("returns portal home for portal routes", () => {
    expect(navigationBackFallback("/portal/knowledge/1")).toBe("/portal");
    expect(navigationBackFallback("/kundeportal-2/mine-sager")).toBe("/portal");
  });

  it("returns classic home for classic routes", () => {
    expect(navigationBackFallback("/classic/incidents")).toBe("/classic");
  });
});

describe("shouldShowNavigationBack", () => {
  it("hides when there is no history", () => {
    expect(shouldShowNavigationBack("/tickets", false)).toBe(false);
  });

  it("shows when history exists on normal routes", () => {
    expect(shouldShowNavigationBack("/tickets", true)).toBe(true);
    expect(shouldShowNavigationBack("/", true)).toBe(true);
  });

  it("hides on login routes", () => {
    expect(shouldShowNavigationBack("/login", true)).toBe(false);
    expect(shouldShowNavigationBack("/login/helpdesk", true)).toBe(false);
  });
});
