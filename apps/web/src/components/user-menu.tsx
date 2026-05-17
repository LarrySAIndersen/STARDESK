"use client";

import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { clearSession, getClientUser } from "@/lib/auth";

export function UserMenu() {
  const router = useRouter();
  const user = getClientUser();

  if (!user) {
    return null;
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    clearSession();
    router.push("/");
    router.refresh();
  }

  const initials = user.display_name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <section className="border-border ml-2 flex items-center gap-2 border-l pl-3">
      <span
        className="bg-primary text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
        aria-hidden
      >
        {initials}
      </span>
      <span className="hidden text-right sm:block">
        <span className="text-foreground block text-sm font-medium leading-none">
          {user.display_name}
        </span>
        <span className="text-muted-foreground text-xs">{user.role_label}</span>
      </span>
      <Badge variant="outline" className="sm:hidden">
        {user.role_label}
      </Badge>
      <Button type="button" variant="ghost" size="sm" onClick={logout}>
        Log ud
      </Button>
    </section>
  );
}
