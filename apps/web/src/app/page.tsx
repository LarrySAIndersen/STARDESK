import { Suspense } from "react";

import { TicketList } from "@/components/ticket-list";
import { TicketListSkeleton } from "@/components/ticket-list-skeleton";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">
          STARdesk — Sagsstyring
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Oversigt over alle sager i systemet.
        </p>
      </header>

      <Suspense fallback={<TicketListSkeleton />}>
        <TicketList />
      </Suspense>
    </main>
  );
}

