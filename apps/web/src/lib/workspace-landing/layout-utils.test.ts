import { describe, expect, it } from "vitest";

import { DEFAULT_WORKSPACE_LANDING } from "@/lib/workspace-landing/catalog";
import {
  applySpaceWidgetUpdate,
  buildSpaceHref,
  buildWorkspaceHref,
  createWidgetInstance,
  hideWidgetInstance,
  moveWidgetInstance,
  needsPostItProvider,
  parseWorkspaceSpace,
  parseWorkspaceView,
  reorderWidgetInstances,
  resolveWorkspaceBackHref,
  toggleWidgetSpan,
  visibleWidgetInstances,
} from "@/lib/workspace-landing/layout-utils";

describe("parseWorkspaceSpace", () => {
  it("defaults to personal", () => {
    expect(parseWorkspaceSpace(null)).toBe("personal");
    expect(parseWorkspaceSpace("personal")).toBe("personal");
  });

  it("accepts team", () => {
    expect(parseWorkspaceSpace("team")).toBe("team");
  });
});

describe("widget layout helpers", () => {
  const sample = DEFAULT_WORKSPACE_LANDING.personal;

  it("reorders visible widgets sequentially", () => {
    const hidden = [{ ...sample[0], hidden: true }];
    const reordered = reorderWidgetInstances([...sample, ...hidden]);
    expect(reordered.every((item) => !item.hidden)).toBe(true);
    expect(reordered.map((item) => item.order)).toEqual([0, 1, 2, 3, 4]);
  });

  it("lists visible widgets sorted by order", () => {
    expect(visibleWidgetInstances(sample).length).toBe(sample.length);
  });

  it("moves widgets up and down", () => {
    const moved = moveWidgetInstance(sample, sample[0].instanceId, 1);
    expect(moved[0].order).toBe(sample[1].order);
  });

  it("ignores invalid move targets", () => {
    expect(moveWidgetInstance(sample, "missing", 1)).toBe(sample);
    expect(moveWidgetInstance(sample, sample[0].instanceId, -1)).toBe(sample);
  });

  it("toggles span and hides widgets", () => {
    const toggled = toggleWidgetSpan(sample, sample[0].instanceId);
    expect(toggled[0]?.span).toBe("half");
    const hidden = hideWidgetInstance(sample, sample[0].instanceId);
    expect(hidden[0]?.hidden).toBe(true);
  });

  it("creates widget instances with catalog defaults", () => {
    const created = createWidgetInstance("team-chat", sample, "test");
    expect(created.kind).toBe("team-chat");
    expect(created.span).toBe("half");
    expect(created.instanceId).toBe("team-chat-test");
  });

  it("updates a space inside the landing config", () => {
    const targetId = DEFAULT_WORKSPACE_LANDING.team[0].instanceId;
    const updated = applySpaceWidgetUpdate(DEFAULT_WORKSPACE_LANDING, "team", (items) =>
      hideWidgetInstance(items, targetId),
    );
    expect(updated.team.find((item) => item.instanceId === targetId)).toBeUndefined();
    expect(updated.team.length).toBe(DEFAULT_WORKSPACE_LANDING.team.length - 1);
  });

  it("builds space href with query params", () => {
    expect(buildSpaceHref("team", "foo=bar")).toBe("/arbejdsrum?foo=bar&space=team");
  });

  it("detects post-it provider requirement", () => {
    expect(needsPostItProvider(sample)).toBe(true);
    expect(needsPostItProvider(DEFAULT_WORKSPACE_LANDING.team)).toBe(false);
  });
});

describe("workspace navigation hrefs", () => {
  it("parses view from query params", () => {
    expect(parseWorkspaceView(null, null)).toBe("grid");
    expect(parseWorkspaceView("sitemap", null)).toBe("sitemap");
    expect(parseWorkspaceView(null, "personal-dashboard-0")).toBe("widget");
  });

  it("builds grid, sitemap and widget hrefs", () => {
    expect(buildWorkspaceHref({ space: "personal", view: "grid" })).toBe(
      "/arbejdsrum?space=personal",
    );
    expect(buildWorkspaceHref({ space: "team", view: "sitemap" })).toBe("/sitemap");
    expect(
      buildWorkspaceHref({
        space: "personal",
        view: "widget",
        widgetInstanceId: "abc-1",
        from: "sitemap",
      }),
    ).toBe("/arbejdsrum?space=personal&widget=abc-1&from=sitemap");
  });

  it("resolves back href from widget and sitemap views", () => {
    expect(resolveWorkspaceBackHref("sitemap", "personal", null)).toBe(
      "/arbejdsrum?space=personal",
    );
    expect(resolveWorkspaceBackHref("widget", "team", "sitemap")).toBe("/sitemap");
    expect(resolveWorkspaceBackHref("widget", "personal", null)).toBe(
      "/arbejdsrum?space=personal",
    );
  });
});
