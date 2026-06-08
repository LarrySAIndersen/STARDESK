import Link from "next/link";
import { AlertCircle } from "lucide-react";

import type { Kp2ServiceMessage } from "@/lib/kundeportal-2/types";
import { KP2_BASE } from "@/lib/kundeportal-2/types";

export function Kp2ServiceMessageBanner({ message }: { message: Kp2ServiceMessage }) {
  return (
    <aside className="kp2-message-banner" aria-labelledby="kp2-message-heading">
      <div className="kp2-message-banner-header">
        <AlertCircle className="size-4 shrink-0" aria-hidden />
        <h2 id="kp2-message-heading" className="text-sm font-semibold">
          Omfattende serviceafbrydelse
        </h2>
      </div>
      <Link
        href={`${KP2_BASE}/driftsmeddelelse/${message.id}`}
        className="kp2-message-banner-link"
      >
        <p className="font-semibold">{message.title}</p>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{message.summary}</p>
      </Link>
    </aside>
  );
}
