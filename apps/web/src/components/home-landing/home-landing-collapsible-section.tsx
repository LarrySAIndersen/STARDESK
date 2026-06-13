"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

const STORAGE_PREFIX = "stardesk-home-section:";

function storageKey(userId: string, sectionId: string): string {
  return `${STORAGE_PREFIX}${userId}:${sectionId}`;
}

function readOpen(userId: string, sectionId: string, defaultOpen: boolean): boolean {
  try {
    const raw = localStorage.getItem(storageKey(userId, sectionId));
    if (raw === "true") return true;
    if (raw === "false") return false;
  } catch {
    // ignore corrupt storage
  }
  return defaultOpen;
}

export function HomeLandingCollapsibleSection({
  userId,
  sectionId,
  title,
  subtitle,
  children,
  defaultOpen = true,
  className,
}: Readonly<{
  userId: string;
  sectionId: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}>) {
  const [open, setOpen] = useState(defaultOpen);
  const [hydrated, setHydrated] = useState(false);
  const panelId = `home-section-${sectionId}`;

  useEffect(() => {
    setOpen(readOpen(userId, sectionId, defaultOpen));
    setHydrated(true);
  }, [userId, sectionId, defaultOpen]);

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(storageKey(userId, sectionId), String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, [userId, sectionId]);

  const isOpen = hydrated ? open : defaultOpen;

  return (
    <section
      className={cn("home-landing__section", className)}
      aria-labelledby={`${panelId}-heading`}
    >
      <button
        type="button"
        id={`${panelId}-heading`}
        className="home-landing__section-toggle"
        onClick={toggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
      >
        <ChevronDown
          className={cn("home-landing__section-chevron size-4 shrink-0", !isOpen && "-rotate-90")}
          aria-hidden
        />
        <span className="min-w-0 flex-1 text-left">
          <span className="home-landing__section-title">{title}</span>
          {subtitle ? <span className="home-landing__section-sub">{subtitle}</span> : null}
        </span>
      </button>
      {isOpen ? (
        <div id={panelId} className="home-landing__section-body">{children}</div>
      ) : null}
    </section>
  );
}
