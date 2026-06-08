import Link from "next/link";

import { KP2_BASE } from "@/lib/kundeportal-2/types";

export default async function Kp2KvitteringPage({
  searchParams,
}: {
  searchParams: Promise<{ nr?: string }>;
}) {
  const { nr } = await searchParams;
  const ticketNumber = nr ?? "SR-2026-00000";

  return (
    <div className="kp2-page mx-auto max-w-lg space-y-4 p-4 pb-12 text-center sm:p-6">
      <h1 className="kp2-page-title">Tak for din henvendelse</h1>
      <p className="text-muted-foreground text-sm">
        Din sag er oprettet og vises nu under Mine sager.
      </p>
      <p className="kp2-card p-4 font-mono text-lg font-semibold">{ticketNumber}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href={`${KP2_BASE}/mine-sager`} className="kp2-btn-primary">
          Gå til Mine sager
        </Link>
        <Link href={KP2_BASE} className="kp2-btn-secondary">
          Forside
        </Link>
      </div>
    </div>
  );
}
