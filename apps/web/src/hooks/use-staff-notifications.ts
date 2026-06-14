"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  loadClassicNotificationPreferences,
  type ClassicNotificationPreferences,
} from "@/lib/classic-notification-preferences";
import { fireAndForget } from "@/lib/fire-and-forget";
import { apiGet } from "@/lib/api";
import {
  bumpStaffNotificationsSeenAt,
  notificationAllowedByPrefs,
  readStaffNotificationsSeenAt,
  type StaffNotification,
} from "@/lib/staff-notifications";

const POLL_MS = 30_000;
const AUTO_DISMISS_MS = 10_000;

export function useStaffNotifications(userId: string | null | undefined) {
  const [active, setActive] = useState<StaffNotification | null>(null);
  const [queue, setQueue] = useState<StaffNotification[]>([]);
  const prefsRef = useRef<ClassicNotificationPreferences | null>(null);
  const dismissedRef = useRef<Set<string>>(new Set());
  const dismissTimerRef = useRef<number | null>(null);

  const loadPrefs = useCallback(() => {
    if (!userId) {
      prefsRef.current = null;
      return;
    }
    prefsRef.current = loadClassicNotificationPreferences(userId);
  }, [userId]);

  const enqueue = useCallback((rows: StaffNotification[]) => {
    const prefs = prefsRef.current;
    if (!prefs) return;

    const fresh = rows.filter(
      (row) =>
        !dismissedRef.current.has(row.id) &&
        notificationAllowedByPrefs(row, prefs),
    );
    if (fresh.length === 0) return;

    setQueue((prev) => {
      const existing = new Set(prev.map((row) => row.id));
      const merged = [...prev];
      for (const row of fresh) {
        if (!existing.has(row.id)) {
          merged.push(row);
          existing.add(row.id);
        }
      }
      merged.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      return merged;
    });
  }, []);

  const poll = useCallback(async () => {
    if (!userId) return;
    try {
      const since = encodeURIComponent(readStaffNotificationsSeenAt());
      const rows = await apiGet<StaffNotification[]>(
        `/api/v1/personal/staff-notifications?since=${since}`,
      );
      enqueue(rows);
    } catch {
      // ignore transient API errors during background poll
    }
  }, [enqueue, userId]);

  const dismissActive = useCallback(() => {
    if (dismissTimerRef.current !== null) {
      window.clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    setActive((current) => {
      if (current) {
        dismissedRef.current.add(current.id);
        bumpStaffNotificationsSeenAt(current.created_at);
      }
      return null;
    });
  }, []);

  useEffect(() => {
    loadPrefs();
  }, [loadPrefs]);

  useEffect(() => {
    if (!userId) return;
    fireAndForget(poll());
    const id = window.setInterval(() => fireAndForget(poll()), POLL_MS);
    return () => window.clearInterval(id);
  }, [poll, userId]);

  useEffect(() => {
    if (active || queue.length === 0) return;
    const [next, ...rest] = queue;
    setActive(next);
    setQueue(rest);
  }, [active, queue]);

  useEffect(() => {
    if (!active) return;
    dismissTimerRef.current = window.setTimeout(dismissActive, AUTO_DISMISS_MS);
    return () => {
      if (dismissTimerRef.current !== null) {
        window.clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
    };
  }, [active, dismissActive]);

  return { active, dismissActive };
}
