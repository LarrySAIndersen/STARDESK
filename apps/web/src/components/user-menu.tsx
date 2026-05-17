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

  function logout() {
    clearSession();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2 border-l pl-3">
      <div className="hidden text-right sm:block">
        <p className="text-sm font-medium leading-none">{user.display_name}</p>
        <p className="text-muted-foreground text-xs">{user.role_label}</p>
      </div>
      <Badge variant="outline" className="sm:hidden">
        {user.role_label}
      </Badge>
      <Button type="button" variant="ghost" size="sm" onClick={logout}>
        Log ud
      </Button>
    </div>
  );
}
