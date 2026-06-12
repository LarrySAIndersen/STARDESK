"use client";

import { type ReactNode, useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type TeamChatDockProps = Readonly<{
  open: boolean;
  children: ReactNode;
}>;

/** Slides chat under the sticky top bar with a magnetic snap on open. */
export function TeamChatDock({ open, children }: TeamChatDockProps) {
  const [snap, setSnap] = useState(false);
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setSnap(true);
      const timer = window.setTimeout(() => setSnap(false), 520);
      return () => window.clearTimeout(timer);
    }
    setSnap(false);
    const timer = window.setTimeout(() => setMounted(false), 380);
    return () => window.clearTimeout(timer);
  }, [open]);

  if (!mounted) return null;

  return (
    <div
      className={cn(
        "team-chat-dock",
        open && "team-chat-dock--open",
        snap && "team-chat-dock--snap",
      )}
      aria-hidden={!open}
    >
      <div className="team-chat-dock__inner">{children}</div>
    </div>
  );
}
