import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_WORKSPACE_LANDING } from "@/lib/workspace-landing/catalog";
import {
  readWorkspaceLanding,
  resetWorkspaceLanding,
  WORKSPACE_LANDING_CHANGED_EVENT,
  writeWorkspaceLanding,
} from "@/lib/workspace-landing/storage";

describe("workspace landing storage", () => {
  const store = new Map<string, string>();
  const userId = "user-123";

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
      },
      dispatchEvent: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns defaults when nothing is stored", () => {
    expect(readWorkspaceLanding(userId)).toEqual(DEFAULT_WORKSPACE_LANDING);
  });

  it("persists and reads custom layouts", () => {
    const custom = {
      personal: [{ instanceId: "x", kind: "my-tickets" as const, order: 0, span: "full" as const, hidden: false }],
      team: DEFAULT_WORKSPACE_LANDING.team,
    };
    writeWorkspaceLanding(userId, custom);
    expect(readWorkspaceLanding(userId).personal[0]?.kind).toBe("my-tickets");
    expect(window.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: WORKSPACE_LANDING_CHANGED_EVENT }),
    );
  });

  it("falls back to defaults for invalid stored JSON", () => {
    store.set("stardesk-workspace-landing:v1:user-123", "{not-json");
    expect(readWorkspaceLanding(userId)).toEqual(DEFAULT_WORKSPACE_LANDING);
  });

  it("resets layout to defaults", () => {
    writeWorkspaceLanding(userId, {
      personal: [],
      team: [],
    });
    expect(resetWorkspaceLanding(userId)).toEqual(DEFAULT_WORKSPACE_LANDING);
    expect(readWorkspaceLanding(userId)).toEqual(DEFAULT_WORKSPACE_LANDING);
  });
});
