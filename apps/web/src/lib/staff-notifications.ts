import type { ClassicNotificationPreferences } from "@/lib/classic-notification-preferences";

export type StaffNotificationKind =
  | "assigned_to_me"
  | "assigned_to_group"
  | "assigned_task_updated"
  | "watched_update"
  | "sla_milestone";

export type StaffNotification = {
  id: string;
  kind: StaffNotificationKind;
  ticket_id: string;
  ticket_number: string;
  title: string;
  summary_da: string;
  created_at: string;
  sla_percent?: number | null;
};

const STORAGE_KEY = "stardesk:staff-notifications-seen-at";

export function readStaffNotificationsSeenAt(): string {
  if (typeof window === "undefined") {
    return new Date(0).toISOString();
  }
  return localStorage.getItem(STORAGE_KEY) ?? new Date(0).toISOString();
}

export function writeStaffNotificationsSeenAt(iso: string) {
  localStorage.setItem(STORAGE_KEY, iso);
}

export function bumpStaffNotificationsSeenAt(iso: string) {
  const current = readStaffNotificationsSeenAt();
  if (iso > current) {
    writeStaffNotificationsSeenAt(iso);
  }
}

const PREF_BY_KIND: Record<
  Exclude<StaffNotificationKind, "watched_update" | "sla_milestone">,
  keyof ClassicNotificationPreferences
> = {
  assigned_to_me: "taskAssignedToMe",
  assigned_to_group: "taskAssignedToMyGroup",
  assigned_task_updated: "assignedTaskUpdated",
};

export function notificationAllowedByPrefs(
  notification: StaffNotification,
  prefs: ClassicNotificationPreferences,
): boolean {
  if (notification.kind === "watched_update" || notification.kind === "sla_milestone") {
    return true;
  }
  const prefKey = PREF_BY_KIND[notification.kind];
  return prefs[prefKey];
}

export function ticketHrefForNotification(
  ticketId: string,
  uiMode: "modern" | "classic",
): string {
  return uiMode === "classic" ? `/classic/tickets/${ticketId}` : `/tickets/${ticketId}`;
}
