"use client";

import { fireAndForget } from "@/lib/fire-and-forget";

import { UsersRound } from "lucide-react";
import { useState } from "react";

import { ImpersonateUserDialog } from "@/components/agent/impersonate-user-dialog";
import { canImpersonateUsers } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { User } from "@/types/user";

export function ImpersonateUserButton({
  user,
  variant = "default",
  className,
}: Readonly<{
  user: User;
  variant?: "default" | "chrome";
  className?: string;
}>) {
  const [open, setOpen] = useState(false);
  const chrome = variant === "chrome";

  if (!canImpersonateUsers(user)) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        className={cn(
          "wire-touch-target inline-flex items-center justify-center rounded-sm transition-colors",
          chrome
            ? "text-white/90 hover:bg-white/10 hover:text-white"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
          className,
        )}
        aria-label="Se som anden bruger"
        title="Se som anden bruger"
        onClick={() => setOpen(true)}
      >
        <UsersRound className="size-5" aria-hidden />
      </button>
      {open ? (
        <ImpersonateUserDialog currentUser={user} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}
