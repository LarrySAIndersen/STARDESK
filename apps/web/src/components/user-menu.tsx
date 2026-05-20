"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { clearSession, getClientUser } from "@/lib/auth";
import type { User } from "@/types/user";

export function UserMenu({ user: serverUser }: { user?: User | null }) {
  const router = useRouter();
  const user = serverUser ?? getClientUser();

  if (!user) {
    return null;
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    clearSession();
    router.push("/");
    router.refresh();
  }

  return (
    <section className="flex items-center">
      <Button type="button" variant="ghost" size="sm" onClick={logout}>
        Log ud
      </Button>
    </section>
  );
}
