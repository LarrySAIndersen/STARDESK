import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  CASE_ASSISTANT_OPEN_EVENT,
  openCaseAssistant,
  type CaseAssistantOpenDetail,
} from "./case-assistant-open";

describe("openCaseAssistant", () => {
  beforeEach(() => {
    vi.stubGlobal("window", new EventTarget());
  });

  it("dispatches open event with draft and focus", () => {
    const handler = vi.fn<(event: CustomEvent<CaseAssistantOpenDetail>) => void>();
    const onEvent = (event: Event) => {
      handler(event as CustomEvent<CaseAssistantOpenDetail>);
    };
    window.addEventListener(CASE_ASSISTANT_OPEN_EVENT, onEvent);

    openCaseAssistant({ draft: "Hej STARbot", focusInput: true });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail).toEqual({
      draft: "Hej STARbot",
      focusInput: true,
      autoSend: false,
    });

    window.removeEventListener(CASE_ASSISTANT_OPEN_EVENT, onEvent);
  });
});
