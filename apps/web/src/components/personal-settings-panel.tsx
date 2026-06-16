"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { AvatarEditor } from "@/components/agent/agent-sidebar-user";
import { UserAvatar } from "@/components/agent/user-avatar";
import { ThemePalettePicker } from "@/components/theme-palette-picker";
import { ThemeToggle } from "@/components/theme-toggle";
import { writeUserCookie, isStaff } from "@/lib/auth";
import { resolveUserAvatar, userProfileHref } from "@/lib/user-avatar";
import type { User } from "@/types/user";

export function PersonalSettingsPanel({ user: userFromServer }: { user: User }) {
  const router = useRouter();
  const [user, setUser] = useState(() => resolveUserAvatar(userFromServer) ?? userFromServer);
  const staff = isStaff(user);

  useEffect(() => {
    setUser(resolveUserAvatar(userFromServer) ?? userFromServer);
  }, [userFromServer]);

  const onUserChange = useCallback(
    (next: User) => {
      writeUserCookie(next);
      setUser(next);
      router.refresh();
    },
    [router],
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <section className="wire-card mb-0">
        <div className="mb-4 flex items-center gap-4">
          <UserAvatar user={user} size="lg" />
          <div>
            <h2 className="wire-card-title mb-0">Profilbillede</h2>
            <p className="text-muted-foreground text-sm">{user.display_name}</p>
          </div>
        </div>
        <AvatarEditor user={user} onUserChange={onUserChange} />
      </section>

      <section className="wire-card mb-0">
        <h2 className="wire-card-title mb-1">Udseende</h2>
        <p className="text-muted-foreground mb-4 text-sm">
          Tilpas hvordan STARdesk ser ud for dig.
        </p>

        <div className="space-y-6">
          <div>
            <h3 className="text-star-navy mb-2 text-xs font-bold uppercase tracking-wide">
              Dag / Nat
            </h3>
            <ThemeToggle />
          </div>

          {staff ? (
            <div>
              <h3 className="text-star-navy mb-2 text-xs font-bold uppercase tracking-wide">
                Farvetema
              </h3>
              <ThemePalettePicker
                user={user}
                layout="inline"
                onUserUpdated={onUserChange}
              />
            </div>
          ) : null}
        </div>
      </section>

      <section className="wire-card mb-0">
        <h2 className="wire-card-title mb-1">Konto</h2>
        <p className="text-muted-foreground mb-4 text-sm">
          Se dine kontooplysninger eller skift adgangskode.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href={userProfileHref(user)}
            className="text-star-blue text-sm font-semibold hover:underline"
          >
            Se profil
          </Link>
          <Link
            href="/skift-adgangskode"
            className="text-star-blue text-sm font-semibold hover:underline"
          >
            Skift adgangskode
          </Link>
        </div>
      </section>
    </div>
  );
}
