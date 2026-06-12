import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_CLASSIC_NOTIFICATION_PREFERENCES,
  loadClassicNotificationPreferences,
  saveClassicNotificationPreferences,
} from "./classic-notification-preferences";

describe("classic notification preferences storage", () => {
  const store = new Map<string, string>();
  const userId = "user-789";

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

  it("returns defaults when nothing stored", () => {
    expect(loadClassicNotificationPreferences(userId)).toEqual(
      DEFAULT_CLASSIC_NOTIFICATION_PREFERENCES,
    );
  });

  it("persists and loads valid preferences", () => {
    const custom = {
      assignedTaskUpdated: false,
      bookmarkedTaskUpdated: true,
      taskAssignedToMe: false,
      taskAssignedToMyGroup: true,
    };
    saveClassicNotificationPreferences(userId, custom);
    expect(loadClassicNotificationPreferences(userId)).toEqual(custom);
  });

  it("falls back to defaults for invalid JSON", () => {
    store.set("stardesk-classic-notification-prefs:user-789", "{bad");
    expect(loadClassicNotificationPreferences(userId)).toEqual(
      DEFAULT_CLASSIC_NOTIFICATION_PREFERENCES,
    );
  });

  it("falls back when stored shape is incomplete", () => {
    store.set(
      "stardesk-classic-notification-prefs:user-789",
      JSON.stringify({ assignedTaskUpdated: true }),
    );
    expect(loadClassicNotificationPreferences(userId)).toEqual(
      DEFAULT_CLASSIC_NOTIFICATION_PREFERENCES,
    );
  });
});
