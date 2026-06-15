"use client";

import { fireAndForget } from "@/lib/fire-and-forget";

import { UsersRound, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { clearSession, isImpersonating, setClientSessionCache } from "@/lib/auth";
import type { User } from "@/types/user";

export function ImpersonationBanner({ user }: { user: User | null }) {
  const router = useRouter();
  const [stopping, setStopping] = useState(false);

  if (!user || !isImpersonating(user)) {
    return null;
  }

  async function stopImpersonation() {
    setStopping(true);
    try {
      const response = await fetch("/api/auth/stop-impersonate", {
        method: "POST",
        credentials: "same-origin",
      });
      if (!response.ok) {
        throw new Error("Kunne ikke afslutte impersonering");
      }
      const body = (await response.json()) as { user?: User };
      if (body.user) {
        setClientSessionCache(body.user);
      } else {
        clearSession();
      }
      router.refresh();
    } finally {
      setStopping(false);
    }
  }

  return (
    <div
      role="status"
      className="border-amber-500/40 bg-amber-100 text-amber-950 dark:bg-amber-950/80 dark:text-amber-50 sticky top-0 z-[99] flex w-full flex-wrap items-center justify-center gap-2 border-b px-3 py-2 text-center text-xs sm:text-sm"
    >
      <UsersRound className="size-4 shrink-0" aria-hidden />
      <span>
        Du ser STARdesk som{" "}
        <strong>{user.display_name}</strong>
        {user.impersonator ? (
          <>
            {" "}
            (impersoneret af {user.impersonator.display_name})
          </>
        ) : null}
      </span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 border-amber-700/30 bg-white/70 px-2 text-xs dark:bg-black/20"
        disabled={stopping}
        onClick={() => fireAndForget(stopImpersonation())}
      >
        <X className="mr-1 size-3.5" aria-hidden />
        {stopping ? "Afslutter…" : "Afslut impersonering"}
      </Button>
    </div>
  );
}
