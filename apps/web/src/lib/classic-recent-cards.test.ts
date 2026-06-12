import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadRecentCards, recordRecentCard } from "./classic-recent-cards";

describe("classic recent cards storage", () => {
  const store = new Map<string, string>();
  const userId = "user-classic";

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("window", {
      localStorage: {
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

  it("returns empty list when nothing stored", () => {
    expect(loadRecentCards(userId)).toEqual([]);
  });

  it("records card at front and deduplicates by id", () => {
    const first = recordRecentCard(userId, {
      id: "t1",
      href: "/classic/tickets/t1",
      ticketNumber: "INC-1",
      title: "First",
      subtitle: "Anna",
    });
    const second = recordRecentCard(userId, {
      id: "t2",
      href: "/classic/tickets/t2",
      ticketNumber: "INC-2",
      title: "Second",
      subtitle: "Bo",
    });
    expect(second.map((c) => c.id)).toEqual(["t2", "t1"]);

    const updated = recordRecentCard(userId, {
      id: "t1",
      href: "/classic/tickets/t1",
      ticketNumber: "INC-1",
      title: "First updated",
      subtitle: "Anna",
    });
    expect(updated[0]?.title).toBe("First updated");
    expect(updated.filter((c) => c.id === "t1")).toHaveLength(1);
  });

  it("ignores invalid stored JSON", () => {
    store.set("stardesk-classic-recent-cards:user-classic", "{bad");
    expect(loadRecentCards(userId)).toEqual([]);
  });
});
