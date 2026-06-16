"use client";

import { Bell, LayoutGrid, Settings, User } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";

import { ClassicNotificationModal } from "@/components/classic/classic-notification-modal";
import {
  loadClassicNotificationPreferences,
  type ClassicNotificationPreferences,
} from "@/lib/classic-notification-preferences";
import type { User as AppUser } from "@/types/user";

export function ClassicTopBarTools({ user }: { user: AppUser | null }) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState<ClassicNotificationPreferences | null>(
    null,
  );

  const openNotifications = useCallback(() => {
    if (!user?.id) return;
    setNotifPrefs(loadClassicNotificationPreferences(user.id));
    setNotifOpen(true);
  }, [user?.id]);

  const closeNotifications = useCallback(() => {
    setNotifOpen(false);
    setNotifPrefs(null);
  }, []);

  return (
    <>
      <div className="classic-topbar__tools" aria-label="Værktøjer">
        <button
          type="button"
          className="classic-topbar__icon-btn"
          aria-label="Overblik"
          title="Overblik"
        >
          <LayoutGrid className="size-[18px]" aria-hidden />
        </button>
        <button
          type="button"
          className="classic-topbar__icon-btn"
          aria-label="Notifikation"
          aria-haspopup="dialog"
          aria-expanded={notifOpen}
          title="Notifikation"
          disabled={!user?.id}
          onClick={openNotifications}
        >
          <Bell className="size-[18px]" aria-hidden />
        </button>
        <Link
          href="/indstillinger"
          className="classic-topbar__icon-btn classic-topbar__icon-btn--profile"
          aria-label="Mine indstillinger"
          title="Mine indstillinger"
        >
          <User className="size-[18px]" aria-hidden />
          <Settings className="classic-topbar__profile-gear size-3" aria-hidden />
        </Link>
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
