"use client";

import { useEffect } from "react";

import { isEditableKeyboardTarget } from "@/lib/keyboard-shortcut";

/** Register a global keyboard shortcut (Ctrl/Cmd + key). */
export function useKeyboardShortcut(
  key: string,
  handler: () => void,
  options?: Readonly<{ shift?: boolean; alt?: boolean; enabled?: boolean }>,
) {
  const shift = options?.shift ?? false;
  const alt = options?.alt ?? false;
  const enabled = options?.enabled ?? true;

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableKeyboardTarget(event.target)) return;
      const mod = event.ctrlKey || event.metaKey;
      if (!mod) return;
      if (shift !== event.shiftKey) return;
      if (alt !== event.altKey) return;
      if (event.key.toLowerCase() !== key.toLowerCase()) return;
      event.preventDefault();
      handler();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [key, handler, shift, alt, enabled]);
}
