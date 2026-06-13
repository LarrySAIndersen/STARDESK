export const CASE_ASSISTANT_OPEN_EVENT = "stardesk:case-assistant-open";
export const CASE_ASSISTANT_TOGGLE_EVENT = "stardesk:case-assistant-toggle";
export const CASE_ASSISTANT_STATE_EVENT = "stardesk:case-assistant-state";

export type CaseAssistantOpenDetail = {
  draft?: string;
  focusInput?: boolean;
  autoSend?: boolean;
};

export function openCaseAssistant(detail: CaseAssistantOpenDetail = {}): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(
    new CustomEvent<CaseAssistantOpenDetail>(CASE_ASSISTANT_OPEN_EVENT, {
      detail: {
        focusInput: detail.focusInput ?? !detail.autoSend,
        draft: detail.draft,
        autoSend: detail.autoSend ?? false,
      },
    }),
  );
}

export function toggleCaseAssistant(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent(CASE_ASSISTANT_TOGGLE_EVENT));
}

export type CaseAssistantStateDetail = { open: boolean };

export function dispatchCaseAssistantState(open: boolean): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(
    new CustomEvent<CaseAssistantStateDetail>(CASE_ASSISTANT_STATE_EVENT, {
      detail: { open },
    }),
  );
}
