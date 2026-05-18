import { Suspense } from "react";
import { cookies } from "next/headers";

import { LoginForm } from "@/components/login-form";
import { TicketList } from "@/components/ticket-list";
import { TicketListShell } from "@/components/ticket-list-shell";
import { TicketListSkeleton } from "@/components/ticket-list-skeleton";
import { getServerUser } from "@/lib/auth-server";
import { isStaff, TOKEN_COOKIE } from "@/lib/auth";

export default async function HomePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value;

  if (!token) {
    return (
      <div className="star-page px-6 py-10">
        <LoginForm />
      </div>
    );
  }

  const currentUser = await getServerUser();
  const staff = isStaff(currentUser);

  const list = (
    <Suspense fallback={<TicketListSkeleton />}>
      <TicketListShell>
        <TicketList />
      </TicketListShell>
    </Suspense>
  );

  if (staff) {
    return list;
  }

  return <main className="star-page">{list}</main>;
}
