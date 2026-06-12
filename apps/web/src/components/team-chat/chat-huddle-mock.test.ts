import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useId: () => "huddle-title-test",
  };
});

vi.mock("@/hooks/use-focus-trap", () => ({
  useFocusTrap: () => ({ current: null }),
}));

vi.mock("@/components/ui/accessible-modal-shell", () => ({
  AccessibleModalBackdrop: ({
    children,
    dismissLabel,
    className,
  }: {
    children: React.ReactNode;
    dismissLabel: string;
    className?: string;
  }) => createElement("div", { className, "data-dismiss-label": dismissLabel }, children),
  AccessibleModalPanel: ({
    children,
    titleId,
    className,
  }: {
    children: React.ReactNode;
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
  Button: ({ children, ...props }: { children: React.ReactNode }) =>
    createElement("button", props, children),
}));

vi.mock("lucide-react", () => ({
  Video: () => createElement("span", { "aria-hidden": true }, "video"),
  X: () => createElement("span", null, "x"),
}));

import { ChatHuddleMock } from "./chat-huddle-mock";

describe("ChatHuddleMock", () => {
  it("renders nothing when closed", () => {
    const html = renderToString(
      createElement(ChatHuddleMock, {
        open: false,
        onClose: () => {},
        channelName: "dev-team",
      }),
    );
    expect(html).toBe("");
  });

  it("renders huddle dialog when open", () => {
    const html = renderToString(
      createElement(ChatHuddleMock, {
        open: true,
        onClose: () => {},
        channelName: "dev-team",
      }),
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain("Huddle — #dev-team");
    expect(html).toContain('id="huddle-title-test"');
  });
});
