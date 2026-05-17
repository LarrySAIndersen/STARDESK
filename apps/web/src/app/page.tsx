import { Suspense } from "react";
import { cookies } from "next/headers";

import { LoginForm } from "@/components/login-form";
import { TicketList } from "@/components/ticket-list";
import { TicketListShell } from "@/components/ticket-list-shell";
import { TicketListSkeleton } from "@/components/ticket-list-skeleton";
import { TOKEN_COOKIE } from "@/lib/auth";

export default async function HomePage() {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;

  if (!token) {
    return (
      <main className="star-page px-6 py-10">
        <LoginForm />
      </main>
    );
  }

  return (
    <main className="star-page">
      <Suspense fallback={<TicketListSkeleton />}>
        <TicketListShell>
          <TicketList />
        </TicketListShell>
      </Suspense>
    </main>
  );
}
