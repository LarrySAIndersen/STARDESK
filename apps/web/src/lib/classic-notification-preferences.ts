export type ClassicNotificationPreferences = {
  /** En opgave tildelt mig er blevet opdateret */
  assignedTaskUpdated: boolean;
  /** En bogmærket opgave er blevet opdateret */
  bookmarkedTaskUpdated: boolean;
  /** En opgave er blevet tildelt mig */
  taskAssignedToMe: boolean;
  /** En opgave er blevet tildelt en af mine ansvarliggrupper */
  taskAssignedToMyGroup: boolean;
};

export const DEFAULT_CLASSIC_NOTIFICATION_PREFERENCES: ClassicNotificationPreferences =
  {
    assignedTaskUpdated: true,
    bookmarkedTaskUpdated: true,
    taskAssignedToMe: true,
    taskAssignedToMyGroup: false,
  };

const STORAGE_PREFIX = "stardesk-classic-notification-prefs";

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}:${userId}`;
}

function parseStored(raw: string): ClassicNotificationPreferences | null {
  try {
    const data = JSON.parse(raw) as Partial<ClassicNotificationPreferences>;
    if (
      typeof data.assignedTaskUpdated !== "boolean" ||
      typeof data.bookmarkedTaskUpdated !== "boolean" ||
      typeof data.taskAssignedToMe !== "boolean" ||
      typeof data.taskAssignedToMyGroup !== "boolean"
    ) {
      return null;
    }
    return {
      assignedTaskUpdated: data.assignedTaskUpdated,
      bookmarkedTaskUpdated: data.bookmarkedTaskUpdated,
      taskAssignedToMe: data.taskAssignedToMe,
      taskAssignedToMyGroup: data.taskAssignedToMyGroup,
    };
  } catch {
    return null;
  }
}

export function loadClassicNotificationPreferences(
  userId: string,
): ClassicNotificationPreferences {
  if (typeof window === "undefined") {
    return { ...DEFAULT_CLASSIC_NOTIFICATION_PREFERENCES };
  }
  const raw = window.localStorage.getItem(storageKey(userId));
  if (!raw) {
    return { ...DEFAULT_CLASSIC_NOTIFICATION_PREFERENCES };
  }
  return parseStored(raw) ?? { ...DEFAULT_CLASSIC_NOTIFICATION_PREFERENCES };
}

export function saveClassicNotificationPreferences(
  userId: string,
  prefs: ClassicNotificationPreferences,
): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(userId), JSON.stringify(prefs));
}
