"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export function CreateTicketOptionalSection({
  title,
  description,
  defaultOpen = false,
  children,
}: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div className="ticket-create-optional rounded-[2px] border border-[var(--gray-border)] bg-card">
      <button
        type="button"
        id={`${panelId}-trigger`}
        className="hover:bg-muted/30 focus-visible:ring-ring flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
      >
        <span className="min-w-0 flex-1">
          <span className="text-foreground block text-sm font-semibold">{title}</span>
          {description ? (
            <span className="text-muted-foreground mt-0.5 block text-xs">{description}</span>
          ) : null}
        </span>
        <ChevronDown
          className={cn(
            "text-muted-foreground size-4 shrink-0 transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {open ? (
        <div
          id={panelId}
          aria-labelledby={`${panelId}-trigger`}
          className="space-y-4 border-t border-[var(--gray-border)] px-4 py-4"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
