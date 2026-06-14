import { describe, expect, it } from "vitest";

import { DEFAULT_CLASSIC_NOTIFICATION_PREFERENCES } from "@/lib/classic-notification-preferences";
import {
  notificationAllowedByPrefs,
  ticketHrefForNotification,
  type StaffNotification,
} from "@/lib/staff-notifications";

const base: StaffNotification = {
  id: "1",
  kind: "assigned_to_me",
  ticket_id: "abc",
  ticket_number: "INC-1",
  title: "Test",
  summary_da: "Summary",
  created_at: "2026-06-01T10:00:00Z",
};

describe("notificationAllowedByPrefs", () => {
  it("respects assignment preference flags", () => {
    const prefs = { ...DEFAULT_CLASSIC_NOTIFICATION_PREFERENCES, taskAssignedToMe: false };
    expect(notificationAllowedByPrefs({ ...base, kind: "assigned_to_me" }, prefs)).toBe(
      false,
    );
    expect(notificationAllowedByPrefs({ ...base, kind: "watched_update" }, prefs)).toBe(
      true,
    );
  });
});

describe("ticketHrefForNotification", () => {
  it("routes classic and modern paths", () => {
    expect(ticketHrefForNotification("tid", "classic")).toBe("/classic/tickets/tid");
    expect(ticketHrefForNotification("tid", "modern")).toBe("/tickets/tid");
  });
});
