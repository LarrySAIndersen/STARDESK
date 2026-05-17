import { cookies } from "next/headers";

import { PageHero } from "@/components/page-hero";
import { isStaff, USER_COOKIE } from "@/lib/auth";
import type { User } from "@/types/user";

export async function TicketListShell({ children }: { children: React.ReactNode }) {
  let currentUser: User | null = null;
  const userCookie = (await cookies()).get(USER_COOKIE)?.value;
  if (userCookie) {
    try {
      currentUser = JSON.parse(decodeURIComponent(userCookie)) as User;
    } catch {
      currentUser = null;
    }
  }

  if (isStaff(currentUser)) {
    return <>{children}</>;
  }

  return (
    <>
      <PageHero
        title="Sagsstyring"
        lead="Se dine sager og opret nye henvendelser til STAR Service Desk."
      />
      {children}
    </>
  );
}
