import { notFound } from "next/navigation";

import { TicketDetailView } from "@/components/ticket-detail";
import { ApiError } from "@/lib/api";
import { apiGetServer } from "@/lib/api-server";
import { cookies } from "next/headers";
import { USER_COOKIE } from "@/lib/auth";
import type { User } from "@/types/user";
import type { TicketDetail } from "@/types/ticket";

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const userCookie = (await cookies()).get(USER_COOKIE)?.value;
  let currentUser: User | null = null;
  if (userCookie) {
    try {
      currentUser = JSON.parse(decodeURIComponent(userCookie)) as User;
    } catch {
      currentUser = null;
    }
  }

  try {
    const ticket = await apiGetServer<TicketDetail>(`/api/v1/tickets/${id}`);
    return (
      <main className="mx-auto max-w-5xl px-6 py-12">
        <TicketDetailView ticket={ticket} currentUser={currentUser} />
      </main>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    return (
      <main className="mx-auto max-w-5xl px-6 py-12">
        <p className="text-destructive text-sm">
          Kunne ikke hente sagen. Tjek at API&apos;et kører.
        </p>
      </main>
    );
  }
}
