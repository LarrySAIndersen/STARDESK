"use client";

import { useEffect } from "react";

import { useClassicWorkTabs } from "@/components/classic/classic-work-tabs-context";

export function ClassicTicketTabSync({
  ticketId,
  ticketNumber,
  title,
  reporterDisplayName,
  assignedUserName,
  organizationHint,
}: {
  ticketId: string;
  ticketNumber: string;
  title: string;
  reporterDisplayName?: string | null;
  assignedUserName?: string | null;
  organizationHint?: string | null;
}) {
  const { updateTicketTab } = useClassicWorkTabs();

  useEffect(() => {
    const person =
      assignedUserName?.trim() ||
      reporterDisplayName?.trim() ||
      "Ukendt";
    const org = organizationHint?.trim();
    const subtitle = org ? `${person} (${org})` : person;

    updateTicketTab({
      ticketId,
      ticketNumber,
      title,
      subtitle,
    });
  }, [
    ticketId,
    ticketNumber,
    title,
    reporterDisplayName,
    assignedUserName,
    organizationHint,
    updateTicketTab,
  ]);

  return null;
}
