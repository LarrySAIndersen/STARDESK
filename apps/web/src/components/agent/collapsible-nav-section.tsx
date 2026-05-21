"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

function sectionStorageKey(sectionId: string): string {
  return `stardesk_nav_section_${sectionId}`;
}

function readSectionOpen(sectionId: string, defaultOpen: boolean): boolean {
  try {
    const raw = localStorage.getItem(sectionStorageKey(sectionId));
    if (raw === "false") {
      return false;
    }
    if (raw === "true") {
      return true;
    }
  } catch {
    // ignore
  }
  return defaultOpen;
}

export function CollapsibleNavSection({
  sectionId,
  label,
  collapsed = false,
  defaultOpen = true,
  children,
}: {
  sectionId: string;
  label: string;
  collapsed?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setOpen(readSectionOpen(sectionId, defaultOpen));
    setHydrated(true);
  }, [sectionId, defaultOpen]);

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(sectionStorageKey(sectionId), String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, [sectionId]);

  if (collapsed) {
    return <>{children}</>;
  }

  const isOpen = hydrated ? open : defaultOpen;

  return (
    <div className="wire-nav-section-group">
      <button
        type="button"
        className="wire-nav-section wire-nav-section--collapsible"
        onClick={toggle}
        aria-expanded={isOpen}
      >
        <ChevronDown
          className={cn("size-3 shrink-0 transition-transform", !isOpen && "-rotate-90")}
          aria-hidden
        />
        <span>{label}</span>
      </button>
      {isOpen ? children : null}
    </div>
  );
}
