import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getPanelLayoutStorage } from "./panel-layout-storage";

describe("getPanelLayoutStorage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns no-op storage on server", () => {
    const storage = getPanelLayoutStorage();
    expect(storage.getItem("key")).toBeNull();
    storage.setItem("key", "value");
    expect(storage.getItem("key")).toBeNull();
  });

  it("returns window localStorage in browser", () => {
    const backing = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => backing.get(key) ?? null,
        setItem: (key: string, value: string) => backing.set(key, value),
        removeItem: (key: string) => backing.delete(key),
        clear: () => backing.clear(),
        key: () => null,
        length: 0,
      },
    });
    const storage = getPanelLayoutStorage();
    storage.setItem("panel", "layout");
    expect(storage.getItem("panel")).toBe("layout");
  });
});
