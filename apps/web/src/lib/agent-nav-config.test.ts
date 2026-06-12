import { Home } from "lucide-react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  NAV_LAYOUT_VERSION,
  buildDefaultNavLayout,
  defaultSectionForItem,
  groupLayoutBySection,
  mergeNavLayout,
  moveNavEntry,
  readNavLayoutFromStorage,
  sanitizeNavLayout,
  writeNavLayoutToStorage,
} from "./agent-nav-config";
import type { AgentNavItem } from "./agent-nav";

const items: AgentNavItem[] = [
  { id: "dashboard", href: "/portal", label: "Dashboard", icon: Home },
  {
    id: "users",
    href: "/admin/users",
    label: "Brugere",
    icon: Home,
    section: "Administration",
  },
  {
    id: "service-desk",
    href: "/service-desk",
    label: "Service desk",
    icon: Home,
  },
];

const availableIds = new Set(items.map((item) => item.id));

describe("defaultSectionForItem", () => {
  it("maps section labels to ids", () => {
    expect(defaultSectionForItem(items[0]!)).toBe("main");
    expect(defaultSectionForItem(items[1]!)).toBe("administration");
  });
});

describe("buildDefaultNavLayout", () => {
  it("builds layout entries and optionally inserts classic UI", () => {
    const layout = buildDefaultNavLayout(items, { includeClassicUi: true });
    expect(layout.version).toBe(NAV_LAYOUT_VERSION);
    expect(layout.entries.some((entry) => entry.id === "classic-ui")).toBe(true);
    const classicIndex = layout.entries.findIndex((entry) => entry.id === "classic-ui");
    const deskIndex = layout.entries.findIndex((entry) => entry.id === "service-desk");
    expect(classicIndex).toBe(deskIndex + 1);
  });
});

describe("sanitizeNavLayout", () => {
  const defaultLayout = buildDefaultNavLayout(items, { includeClassicUi: false });

  it("returns default for invalid saved layout", () => {
    expect(sanitizeNavLayout(null, defaultLayout, availableIds)).toEqual(defaultLayout);
  });

  it("deduplicates and appends missing default entries", () => {
    const saved = {
      version: NAV_LAYOUT_VERSION,
      entries: [
        { id: "dashboard", sectionId: "main" as const },
        { id: "dashboard", sectionId: "main" as const },
        { id: "users", sectionId: "administration" as const },
      ],
    };
    const merged = sanitizeNavLayout(saved, defaultLayout, availableIds);
    expect(merged.entries.filter((entry) => entry.id === "dashboard")).toHaveLength(1);
    expect(merged.entries.some((entry) => entry.id === "service-desk")).toBe(true);
  });
});

describe("mergeNavLayout", () => {
  it("delegates to sanitize when version matches", () => {
    const defaultLayout = buildDefaultNavLayout(items, { includeClassicUi: false });
    expect(mergeNavLayout(null, defaultLayout, availableIds)).toEqual(defaultLayout);
  });
});

describe("groupLayoutBySection", () => {
  it("groups entries by section for available ids", () => {
    const layout = buildDefaultNavLayout(items, { includeClassicUi: false });
    const grouped = groupLayoutBySection(layout, availableIds);
    expect(grouped.some((section) => section.sectionId === "administration")).toBe(true);
  });
});

describe("moveNavEntry", () => {
  it("moves entry to target section before optional anchor", () => {
    const layout = buildDefaultNavLayout(items, { includeClassicUi: false });
    const moved = moveNavEntry(layout, "dashboard", "administration", "users");
    const dashboard = moved.entries.find((entry) => entry.id === "dashboard");
    expect(dashboard?.sectionId).toBe("administration");
    expect(moved.entries.findIndex((entry) => entry.id === "dashboard")).toBe(
      moved.entries.findIndex((entry) => entry.id === "users") - 1,
    );
  });
});

describe("nav layout storage", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    });
    vi.stubGlobal("window", { localStorage: globalThis.localStorage });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads and writes layout JSON", () => {
    const layout = buildDefaultNavLayout(items, { includeClassicUi: false });
    writeNavLayoutToStorage(layout);
    expect(readNavLayoutFromStorage()).toEqual(layout);
  });

  it("returns null for invalid stored layout", () => {
    store.set("stardesk-nav-layout", "{bad");
    expect(readNavLayoutFromStorage()).toBeNull();
  });
});
