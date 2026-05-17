import { Suspense } from "react";
import { cookies } from "next/headers";

import { LoginForm } from "@/components/login-form";
import { TicketList } from "@/components/ticket-list";
import { TicketListShell } from "@/components/ticket-list-shell";
import { TicketListSkeleton } from "@/components/ticket-list-skeleton";
import { isStaff, TOKEN_COOKIE, USER_COOKIE } from "@/lib/auth";
import type { User } from "@/types/user";

export default async function HomePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value;

  if (!token) {
    return (
      <main className="star-page px-6 py-10">
        <LoginForm />
      </main>
    );
  }

  let currentUser: User | null = null;
  const userCookie = cookieStore.get(USER_COOKIE)?.value;
  if (userCookie) {
    try {
      currentUser = JSON.parse(decodeURIComponent(userCookie)) as User;
    } catch {
      currentUser = null;
    }
  }
  const staff = isStaff(currentUser);

  return (
    <main className={staff ? "mx-auto w-full max-w-7xl" : "star-page"}>
      <Suspense fallback={<TicketListSkeleton />}>
        <TicketListShell>
          <TicketList />
        </TicketListShell>
      </Suspense>
    </main>
  );
}
