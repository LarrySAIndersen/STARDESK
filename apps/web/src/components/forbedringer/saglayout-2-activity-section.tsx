"use client";

import {
  pageLayoutSagaActiveClass,
} from "@/components/page-layout/page-layout-edit-saga-indicator";
import { PageLayoutSection } from "@/components/page-layout/page-layout-field";
import { usePageLayoutEdit } from "@/components/page-layout/page-layout-edit-provider";
import { TicketActivityPanel } from "@/components/ticket-activity-panel";
import type { TicketActivityItem, TicketTimestamps } from "@/types/ticket-activity";

export function Saglayout2ActivitySection({
  timestamps,
  activity,
}: {
  timestamps: TicketTimestamps;
  activity: TicketActivityItem[];
}) {
  const { canEdit, editMode } = usePageLayoutEdit();

  return (
    <PageLayoutSection
      fieldId="activity"
      defaultLabel="Aktivitet"
      defaultOrder={900}
      className={pageLayoutSagaActiveClass(canEdit, editMode, "portal-v2-card p-4 sm:p-5")}
      contentClassName="space-y-4"
    >
      <TicketActivityPanel timestamps={timestamps} activity={activity} />
    </PageLayoutSection>
  );
}
