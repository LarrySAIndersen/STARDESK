import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  dispatchMentionsOverviewChanged,
  MENTIONS_OVERVIEW_CHANGED_EVENT,
} from "@/types/ticket-internal-chat";

describe("dispatchMentionsOverviewChanged", () => {
  beforeEach(() => {
    vi.stubGlobal("window", new EventTarget());
  });

  it("dispatches custom event in browser", () => {
    const handler = vi.fn();
    window.addEventListener(MENTIONS_OVERVIEW_CHANGED_EVENT, handler);
    dispatchMentionsOverviewChanged();
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener(MENTIONS_OVERVIEW_CHANGED_EVENT, handler);
  });

  it("no-ops when window is undefined", () => {
    vi.stubGlobal("window", undefined);
    expect(() => dispatchMentionsOverviewChanged()).not.toThrow();
  });
});
