"use client";

import { usePageLayoutEdit } from "@/components/page-layout/page-layout-edit-provider";
import { cn } from "@/lib/utils";

/** Visible pulse + label on the ticket/case when layout design mode is active. */
export function PageLayoutEditSagaIndicator({ className }: { className?: string }) {
  const { canEdit, editMode } = usePageLayoutEdit();

  if (!canEdit || !editMode) {
    return null;
  }

  return (
    <div
      className={cn("page-layout-saga-indicator", className)}
      role="status"
      aria-live="polite"
      aria-label="Design-tilstand aktiv på sagen"
    >
      <span className="page-layout-saga-indicator__pulse" aria-hidden />
      <span className="page-layout-saga-indicator__text">Design-tilstand — rediger felter på sagen</span>
    </div>
  );
}

export function pageLayoutSagaActiveClass(
  canEdit: boolean,
  editMode: boolean,
  className?: string,
): string {
  return cn(className, canEdit && editMode && "page-layout-saga--active");
}
