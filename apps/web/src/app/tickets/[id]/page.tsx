import { notFound } from "next/navigation";

import { TicketDetailView } from "@/components/ticket-detail";
import { apiGet, ApiError } from "@/lib/api";
import type { TicketDetail } from "@/types/ticket";

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  try {
    const ticket = await apiGet<TicketDetail>(`/api/v1/tickets/${id}`);
    return (
      <main className="mx-auto max-w-5xl px-6 py-12">
        <TicketDetailView ticket={ticket} />
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
