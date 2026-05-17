import { Suspense } from "react";

import { PageHero } from "@/components/page-hero";
import { TicketList } from "@/components/ticket-list";
import { TicketListSkeleton } from "@/components/ticket-list-skeleton";

export default function HomePage() {
  return (
    <main className="star-page">
      <PageHero
        title="Sagsstyring"
        lead="Agenter ser åbne store sager øverst og derefter sin kø. Kunder og organisationer ser alle egne sager — med STAR's farver og struktur fra star.dk."
      />

      <Suspense fallback={<TicketListSkeleton />}>
        <TicketList />
      </Suspense>
    </main>
  );
}
