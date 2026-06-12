import { createElement, createRef, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/accessible-modal-shell", () => ({
  AccessibleModalBackdrop: ({
    children,
    dismissLabel,
    className,
  }: {
    children: ReactNode;
    dismissLabel: string;
    className?: string;
  }) => createElement("div", { className, "data-dismiss-label": dismissLabel }, children),
  AccessibleModalPanel: ({
    children,
    titleId,
    className,
  }: {
    children: ReactNode;
    titleId: string;
    className?: string;
  }) =>
    createElement(
      "div",
      { role: "dialog", "aria-labelledby": titleId, className },
      children,
    ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: { children: ReactNode }) =>
    createElement("button", props, children),
}));

vi.mock("lucide-react", () => ({
  Video: () => createElement("span", { "aria-hidden": true }, "video"),
  X: () => createElement("span", null, "x"),
}));

import {
  HUDDLE_MOCK_PARTICIPANTS,
  renderChatHuddleMockContent,
} from "./chat-huddle-mock-content";

describe("HUDDLE_MOCK_PARTICIPANTS", () => {
  it("lists three mock huddle participants", () => {
    expect(HUDDLE_MOCK_PARTICIPANTS).toHaveLength(3);
    expect(HUDDLE_MOCK_PARTICIPANTS.map((p) => p.initials)).toEqual(["AK", "LK", "DU"]);
  });
});

describe("renderChatHuddleMockContent", () => {
  it("renders accessible dialog markup for the channel", () => {
    const html = renderToString(
      renderChatHuddleMockContent({
        channelName: "dev-team",
        titleId: "huddle-title",
        trapRef: createRef(),
        onClose: () => {},
      }),
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain("Huddle — #dev-team");
    expect(html).toContain('id="huddle-title"');
    expect(html).toContain("Anna K.");
    expect(html).toContain("Forlad huddle");
    expect(html).toContain("Luk huddle");
    expect(html).toContain("team-chat-huddle-backdrop");
    expect(html).toContain('data-dismiss-label="Luk huddle"');
  });
});
