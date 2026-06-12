import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CLASSIC_HOME_TAB,
  loadWorkTabsState,
  mergeTabs,
  pathnameToTab,
  saveWorkTabsState,
  workTabsStorageKey,
} from "./classic-work-tabs";

describe("pathnameToTab", () => {
  it("maps home, module list, static page and ticket paths", () => {
    expect(pathnameToTab("/classic")).toEqual(CLASSIC_HOME_TAB);
    expect(pathnameToTab("/classic/incidents")).toMatchObject({
      href: "/classic/incidents",
      kind: "list",
      label: "Incidents",
    });
    expect(pathnameToTab("/classic/my-work")).toMatchObject({
      href: "/classic/my-work",
      kind: "page",
    });
    expect(pathnameToTab("/classic/tickets/ticket-99")).toMatchObject({
      id: "ticket:ticket-99",
      kind: "ticket",
    });
    expect(pathnameToTab("/classic/unknown")).toBeNull();
  });
});

describe("mergeTabs", () => {
  it("updates existing tab by href and appends new closable tabs", () => {
    const home = { ...CLASSIC_HOME_TAB };
    const incidents = pathnameToTab("/classic/incidents")!;
    const merged = mergeTabs([home], incidents);
    expect(merged).toHaveLength(2);

    const updated = mergeTabs(merged, { ...incidents, label: "Incidents (opdateret)" });
    expect(updated).toHaveLength(2);
    expect(updated[1]?.label).toBe("Incidents (opdateret)");
  });

  it("does not duplicate home tab", () => {
    const home = { ...CLASSIC_HOME_TAB };
    expect(mergeTabs([home], home)).toEqual([home]);
  });
});

describe("classic work tabs session storage", () => {
  const store = new Map<string, string>();
  const userId = "user-456";

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses per-user storage key", () => {
    expect(workTabsStorageKey(userId)).toBe("stardesk-classic-work-tabs:user-456");
  });

  it("persists and restores tab state with home tab enforced", () => {
    const incidents = pathnameToTab("/classic/incidents")!;
    saveWorkTabsState(userId, [incidents], incidents.id);
    const loaded = loadWorkTabsState(userId);
    expect(loaded?.tabs[0]?.id).toBe(CLASSIC_HOME_TAB.id);
    expect(loaded?.tabs.some((t) => t.href === "/classic/incidents")).toBe(true);
    expect(loaded?.activeId).toBe(incidents.id);
  });

  it("returns null for missing or invalid storage", () => {
    expect(loadWorkTabsState(userId)).toBeNull();
    store.set(workTabsStorageKey(userId), "{bad");
    expect(loadWorkTabsState(userId)).toBeNull();
  });
});
