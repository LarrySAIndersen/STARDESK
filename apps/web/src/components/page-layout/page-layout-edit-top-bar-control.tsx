"use client";

import { PenLine } from "lucide-react";

import { usePageLayoutEdit } from "@/components/page-layout/page-layout-edit-provider";
import { cn } from "@/lib/utils";

/** Central top-bar control for admins — avoids overlap with bottom-right chat FAB. */
export function PageLayoutEditTopBarControl() {
  const { canEdit, editMode, setEditMode } = usePageLayoutEdit();

  if (!canEdit) {
    return null;
  }

  return (
    <button
      type="button"
      className={cn(
        "wire-topbar-layout-design-btn",
        editMode && "wire-topbar-layout-design-btn--active",
      )}
      data-testid="page-layout-edit-trigger"
      onClick={() => setEditMode(!editMode)}
      aria-pressed={editMode}
      title="Administrator: tilpas felter på denne side (design-tilstand)"
    >
      <PenLine className="size-4 shrink-0" aria-hidden />
      <span>{editMode ? "Designer aktiv" : "Tilpas layout"}</span>
    </button>
  );
}
