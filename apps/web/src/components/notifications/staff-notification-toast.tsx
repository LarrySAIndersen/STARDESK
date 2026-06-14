"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";

import { useStaffNotifications } from "@/hooks/use-staff-notifications";
import { resolveEffectiveUiMode } from "@/lib/classic-ui-mode";
import { ticketHrefForNotification } from "@/lib/staff-notifications";
import type { User } from "@/types/user";

export function StaffNotificationToast({ user }: { user: User | null | undefined }) {
  const pathname = usePathname();
  const { active, dismissActive } = useStaffNotifications(user?.id);
  const uiMode = pathname.startsWith("/classic")
    ? "classic"
    : resolveEffectiveUiMode(user?.ui_mode, null);

  if (!active || !user?.id) {
    return null;
  }

  const href = ticketHrefForNotification(active.ticket_id, uiMode);

  return (
    <div className="staff-notification-toast" role="status" aria-live="polite">
      <button
        type="button"
        className="staff-notification-toast__dismiss"
        aria-label="Luk notifikation"
        onClick={dismissActive}
      >
        <X className="size-3.5" aria-hidden />
      </button>
      <p className="staff-notification-toast__eyebrow">Opdatering på sag</p>
      <p className="staff-notification-toast__summary">{active.summary_da}</p>
      <Link
        href={href}
        className="staff-notification-toast__link"
        onClick={dismissActive}
      >
        {active.ticket_number}
      </Link>
      <p className="staff-notification-toast__title">{active.title}</p>
    </div>
  );
}
