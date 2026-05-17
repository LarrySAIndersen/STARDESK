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

  return (
    <div className="border-star-blue/30 ml-2 flex items-center gap-2 border-l pl-3">
      <div className="hidden text-right sm:block">
        <p className="text-star-navy text-sm font-medium leading-none">{user.display_name}</p>
        <p className="text-star-blue text-xs">{user.role_label}</p>
      </div>
      <Badge variant="outline" className="border-star-blue text-star-blue sm:hidden">
        {user.role_label}
      </Badge>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-star-navy hover:text-star-blue"
        onClick={logout}
      >
        Log ud
      </Button>
    </div>
  );
}
