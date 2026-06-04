"use client";

import { Bot, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { User } from "@/types/user";

export function CaseAssistantChat({ user }: { user: User | null }) {
  const [open, setOpen] = useState(false);

  const librechatUrl = process.env.NEXT_PUBLIC_LIBRECHAT_URL || "http://localhost:3080";

  return (
    <>
      <button
        type="button"
        className={cn("case-assistant-fab", open && "case-assistant-fab--open")}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label="Sag-assistent"
      >
        <Bot className="size-5 shrink-0" aria-hidden />
        <span className="case-assistant-fab-label">Spørg om sager</span>
      </button>

      {open ? (
        <div
          className="case-assistant-panel"
          role="dialog"
          aria-label="Sag-assistent"
        >
          <header className="case-assistant-panel-header">
            <div>
              <p className="case-assistant-panel-title">Sag-assistent</p>
              <p className="case-assistant-panel-sub">
                Spørg om dine sager, systemer og vejledninger
              </p>
            </div>
            <button
              type="button"
              className="case-assistant-panel-close"
              onClick={() => setOpen(false)}
              aria-label="Luk"
            >
              <X className="size-4" />
            </button>
          </header>

          <div className="w-full h-[450px] overflow-hidden bg-white">
            <iframe
              src={`${librechatUrl}/?embed=true`}
              className="w-full h-full border-none"
              title="Sag-assistent"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
