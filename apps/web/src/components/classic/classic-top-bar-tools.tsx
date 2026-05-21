"use client";

import { Bell, Settings, User } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { ClassicOverviewMenuButton } from "@/components/classic/classic-overview-menu";
import { ClassicNotificationModal } from "@/components/classic/classic-notification-modal";
import {
  loadClassicNotificationPreferences,
  type ClassicNotificationPreferences,
} from "@/lib/classic-notification-preferences";
import type { User as AppUser } from "@/types/user";

const NOTIF_SEEN_KEY = "stardesk-classic-notif-seen";

export function ClassicTopBarTools({ user }: { user: AppUser | null }) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState<ClassicNotificationPreferences | null>(
    null,
  );
  const [showNotifBadge, setShowNotifBadge] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    const seen =
      typeof window !== "undefined" &&
      window.sessionStorage.getItem(NOTIF_SEEN_KEY) === "1";
    setShowNotifBadge(!seen);
  }, [user?.id]);

  const openNotifications = useCallback(() => {
    if (!user?.id) return;
    setNotifPrefs(loadClassicNotificationPreferences(user.id));
    setNotifOpen(true);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(NOTIF_SEEN_KEY, "1");
    }
    setShowNotifBadge(false);
  }, [user?.id]);

  const closeNotifications = useCallback(() => {
    setNotifOpen(false);
    setNotifPrefs(null);
  }, []);

  return (
    <>
      <div className="classic-topbar__tools" aria-label="Værktøjer">
        <ClassicOverviewMenuButton />
        <button
          type="button"
          className="classic-topbar__icon-btn classic-topbar__icon-btn--bell"
          aria-label="Notifikation"
          aria-haspopup="dialog"
          aria-expanded={notifOpen}
          title="Notifikation"
          disabled={!user?.id}
          onClick={openNotifications}
        >
          <Bell className="size-[18px]" aria-hidden />
          {showNotifBadge ? (
            <span className="classic-topbar__badge" aria-hidden />
          ) : null}
        </button>
        <button
          type="button"
          className="classic-topbar__icon-btn classic-topbar__icon-btn--profile"
          aria-label="Mine indstillinger"
          title="Mine indstillinger"
          disabled
        >
          <User className="size-[18px]" aria-hidden />
          <Settings className="classic-topbar__profile-gear size-3" aria-hidden />
        </button>
      </div>

      {notifOpen && user?.id && notifPrefs ? (
        <ClassicNotificationModal
          userId={user.id}
          initialPrefs={notifPrefs}
          onClose={closeNotifications}
        />
      ) : null}
    </>
  );
}
