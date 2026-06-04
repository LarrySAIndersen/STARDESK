"use client";

import type { ReactNode, RefObject } from "react";

import { cn } from "@/lib/utils";

export function AccessibleModalBackdrop({
  onClose,
  children,
  className,
  dismissClassName,
  dismissLabel = "Luk dialog",
  unstyled = false,
}: {
  onClose: () => void;
  children: ReactNode;
  className?: string;
  dismissClassName?: string;
  dismissLabel?: string;
  /** Use classic/CSS-only backdrop styling (no default Tailwind overlay). */
  unstyled?: boolean;
}) {
  return (
    <div
      className={cn(
        !unstyled && "fixed inset-0 z-50 flex items-center justify-center p-4",
        className,
      )}
    >
      <button
        type="button"
        className={cn(
          !unstyled && "absolute inset-0 border-0 bg-black/50 p-0",
          dismissClassName,
        )}
        aria-label={dismissLabel}
        onClick={onClose}
      />
      {children}
    </div>
  );
}

export function AccessibleModalPanel({
  trapRef,
  titleId,
  onClose,
  children,
  className,
}: {
  trapRef: RefObject<HTMLDivElement | null>;
  titleId: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      ref={trapRef}
      role="dialog"
      aria-labelledby={titleId}
      aria-modal="true"
      className={cn("relative", className)}
      onMouseDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.key === "Escape" && onClose()}
    >
      {children}
    </div>
  );
}
