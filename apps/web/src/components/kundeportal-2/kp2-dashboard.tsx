import { Kp2ServiceMessageBanner } from "@/components/kundeportal-2/kp2-service-message-banner";
import { Kp2TileGrid } from "@/components/kundeportal-2/kp2-tile-grid";
import { KP2_FEATURED_TILES, KP2_SERVICE_MESSAGES } from "@/lib/kundeportal-2/mock-data";
import { KP2_BASE } from "@/lib/kundeportal-2/types";
import Link from "next/link";

export function Kp2Dashboard() {
  const message = KP2_SERVICE_MESSAGES[0];

  return (
    <div className="kp2-page mx-auto max-w-6xl p-4 pb-12 sm:p-6">
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        {message ? <Kp2ServiceMessageBanner message={message} /> : null}
        <div>
          <div className="mb-4 flex items-center justify-between gap-4">
            <h1 className="sr-only">Kundeportal #2 — Forside</h1>
            <p className="text-muted-foreground text-sm">
              Genveje til de mest brugte funktioner. Fuldt katalog under{" "}
              <Link href={`${KP2_BASE}/service-requests`} className="text-primary underline">
                Service Requests & Changes
              </Link>
              .
            </p>
          </div>
          <Kp2TileGrid tiles={KP2_FEATURED_TILES} />
        </div>
      </div>
    </div>
  );
}
