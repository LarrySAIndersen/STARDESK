"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

type MobileNavDrawerProps = Readonly<{
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}>;

export function MobileNavDrawer({
  open,
  onClose,
  title = "Menu",
  children,
  className,
}: MobileNavDrawerProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="mobile-nav-drawer fixed inset-0 z-[200] lg:hidden" role="presentation">
      <button
        type="button"
        className="mobile-nav-drawer-backdrop absolute inset-0 bg-star-navy/50"
        aria-label="Luk menu"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "mobile-nav-drawer-panel wire-sidebar absolute inset-y-0 left-0 flex w-[min(100vw-3rem,18rem)] max-w-full flex-col border-r border-border bg-sidebar shadow-xl outline-none",
          className,
        )}
      >
        <div className="wire-shell-col-header flex shrink-0 items-center justify-between gap-2 px-3">
          <p id={titleId} className="text-star-navy text-sm font-bold">
            {title}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="wire-touch-target text-[var(--gray-mid)] hover:bg-star-blue-light hover:text-star-navy flex items-center justify-center rounded-sm"
            aria-label="Luk menu"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
