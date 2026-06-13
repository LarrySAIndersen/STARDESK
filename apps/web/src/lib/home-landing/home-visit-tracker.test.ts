import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { readHomeVisitCount, recordHomeVisit } from "./home-visit-tracker";

describe("home visit tracker", () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
    });
    vi.stubGlobal("window", {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("increments visit count per user per day", () => {
    expect(recordHomeVisit("user-1")).toBe(1);
    expect(recordHomeVisit("user-1")).toBe(2);
    expect(readHomeVisitCount("user-1")).toBe(2);
  });

  it("returns zero when no visits recorded", () => {
    expect(readHomeVisitCount("user-2")).toBe(0);
  });

  it("returns safe defaults without window", () => {
    vi.stubGlobal("window", undefined);
    expect(recordHomeVisit("user-3")).toBe(1);
    expect(readHomeVisitCount("user-3")).toBe(0);
  });
});
