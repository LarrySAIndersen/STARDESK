"use client";

import { useCallback, useEffect, useState } from "react";

import { HelpABotAvatarPicker } from "@/components/portal/help-a-bot-avatar-picker";
import {
  HelpABotAvatar,
  HELP_A_BOT_AVATAR_STORAGE_KEY,
  isValidHelpABotAvatarId,
  type HelpABotAvatarId,
} from "@/components/portal/help-a-bot-icon";
import { getCaseAssistantBotLabels } from "@/lib/case-assistant-chat-panel";
import { toggleCaseAssistant, CASE_ASSISTANT_STATE_EVENT, type CaseAssistantStateDetail } from "@/lib/case-assistant-open";
import { cn } from "@/lib/utils";

export function HelpABotChromeTrigger() {
  const { botName, fabLabel } = getCaseAssistantBotLabels(true);
  const [selectedAvatarId, setSelectedAvatarId] = useState<HelpABotAvatarId>("robot");
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleState(event: Event) {
      const detail = (event as CustomEvent<CaseAssistantStateDetail>).detail;
      if (detail) {
        setOpen(detail.open);
      }
    }

    window.addEventListener(CASE_ASSISTANT_STATE_EVENT, handleState);
    return () => window.removeEventListener(CASE_ASSISTANT_STATE_EVENT, handleState);
  }, []);

  useEffect(() => {
    try {
      const storedAvatar = localStorage.getItem(HELP_A_BOT_AVATAR_STORAGE_KEY);
      if (storedAvatar && isValidHelpABotAvatarId(storedAvatar)) {
        setSelectedAvatarId(storedAvatar);
      }
    } catch {
      // ignore corrupt storage
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(HELP_A_BOT_AVATAR_STORAGE_KEY, selectedAvatarId);
  }, [selectedAvatarId]);

  const handleClick = useCallback(() => {
    toggleCaseAssistant();
  }, []);

  const handleAvatarDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAvatarPickerOpen(true);
  }, []);

  return (
    <>
      <button
        type="button"
        className={cn("wire-topheader__helpabot", open && "wire-topheader__helpabot--open")}
        onClick={handleClick}
        aria-expanded={open}
        aria-label={botName}
        title="Dobbeltklik på botten for avatar"
      >
        <span
          className="shrink-0 cursor-pointer"
          onDoubleClick={handleAvatarDoubleClick}
          aria-hidden
        >
          <HelpABotAvatar avatarId={selectedAvatarId} className="size-9" />
        </span>
        <span className="font-semibold">{fabLabel}</span>
      </button>
      <HelpABotAvatarPicker
        open={avatarPickerOpen}
        selectedId={selectedAvatarId}
        onSelect={setSelectedAvatarId}
        onClose={() => setAvatarPickerOpen(false)}
      />
    </>
  );
}
