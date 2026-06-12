"use client";

import { useId } from "react";

import { renderChatHuddleMockContent } from "@/components/team-chat/chat-huddle-mock-content";
import { useFocusTrap } from "@/hooks/use-focus-trap";

export function ChatHuddleMock({
  open,
  onClose,
  channelName,
}: {
  open: boolean;
  onClose: () => void;
  channelName: string;
}) {
  const titleId = useId();
  const trapRef = useFocusTrap(open);

  if (!open) {
    return null;
  }

  return renderChatHuddleMockContent({ channelName, titleId, trapRef, onClose });
}
