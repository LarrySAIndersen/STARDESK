"use client";

import type { ReactNode } from "react";

import { PageLayoutEditSagaIndicator } from "@/components/page-layout/page-layout-edit-saga-indicator";
import { usePageLayoutEdit } from "@/components/page-layout/page-layout-edit-provider";
import { cn } from "@/lib/utils";

/** Global design-mode strip at top of main content (all staff pages). */
export function PageLayoutEditMainChrome({ children }: { children: ReactNode }) {
  const { canEdit, editMode } = usePageLayoutEdit();

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-x-hidden outline-none",
        canEdit && editMode && "page-layout-main--active",
      )}
    >
      {canEdit && editMode ? (
        <PageLayoutEditSagaIndicator className="page-layout-saga-indicator--global mx-4 mt-3 shrink-0 sm:mx-5" />
      ) : null}
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
        {children}
      </div>
    </main>
  );
}
