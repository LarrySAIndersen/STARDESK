import { describe, expect, it, vi } from "vitest";

import {
  dispatchMentionsOverviewChanged,
  MENTIONS_OVERVIEW_CHANGED_EVENT,
} from "@/types/ticket-internal-chat";

describe("dispatchMentionsOverviewChanged", () => {
  it("dispatches custom event in browser", () => {
    const handler = vi.fn();
    window.addEventListener(MENTIONS_OVERVIEW_CHANGED_EVENT, handler);
    dispatchMentionsOverviewChanged();
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener(MENTIONS_OVERVIEW_CHANGED_EVENT, handler);
  });
});
