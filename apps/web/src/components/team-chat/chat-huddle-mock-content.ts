/* eslint-disable react/no-children-prop -- createElement with typed function components requires children in props */
import { createElement, type ReactNode, type RefObject } from "react";
import { Video, X } from "lucide-react";

import {
  AccessibleModalBackdrop,
  AccessibleModalPanel,
} from "@/components/ui/accessible-modal-shell";
import { Button } from "@/components/ui/button";

export const HUDDLE_MOCK_PARTICIPANTS = [
  { initials: "AK", name: "Anna K." },
  { initials: "LK", name: "Lars K." },
  { initials: "DU", name: "Dig" },
] as const;

function huddleParticipantTiles(): ReactNode[] {
  return HUDDLE_MOCK_PARTICIPANTS.map((participant) =>
    createElement(
      "div",
      { key: participant.initials, className: "team-chat-huddle-tile" },
      createElement("span", { className: "team-chat-huddle-avatar" }, participant.initials),
      createElement("span", { className: "text-[11px] font-medium" }, participant.name),
    ),
  );
}

export function renderChatHuddleMockContent({
  channelName,
  titleId,
  trapRef,
  onClose,
}: {
  channelName: string;
  titleId: string;
  trapRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
}) {
  const panel = createElement(AccessibleModalPanel, {
    trapRef,
    titleId,
    onClose,
    className: "team-chat-huddle-dialog",
    children: [
      createElement(
        "header",
        { className: "mb-3 flex items-center justify-between gap-2" },
        createElement(
          "h2",
          { id: titleId, className: "flex items-center gap-2 text-sm font-bold text-star-navy" },
          createElement(Video, { className: "size-4", "aria-hidden": true }),
          `Huddle — #${channelName}`,
        ),
        createElement(
          "button",
          {
            type: "button",
            className: "text-muted-foreground hover:text-foreground rounded p-1",
            onClick: onClose,
            "aria-label": "Luk huddle",
          },
          createElement(X, { className: "size-4" }),
        ),
      ),
      createElement(
        "p",
        { className: "text-muted-foreground mb-3 text-xs" },
        "Video-mockup — rigtig WebRTC-integration kommer senere.",
      ),
      createElement("div", { className: "team-chat-huddle-grid" }, ...huddleParticipantTiles()),
      createElement(
        "div",
        { className: "mt-4 flex flex-wrap gap-2" },
        createElement(Button, { type: "button", size: "sm", variant: "outline", disabled: true }, "Slå kamera til"),
        createElement(Button, { type: "button", size: "sm", variant: "outline", disabled: true }, "Slå mikrofon fra"),
        createElement(
          Button,
          { type: "button", size: "sm", variant: "destructive", onClick: onClose },
          "Forlad huddle",
        ),
      ),
    ],
  });

  return createElement(AccessibleModalBackdrop, {
    onClose,
    unstyled: true,
    className: "team-chat-huddle-backdrop",
    dismissClassName: "absolute inset-0 border-0 bg-transparent p-0",
    dismissLabel: "Luk huddle",
    children: panel,
  });
}
