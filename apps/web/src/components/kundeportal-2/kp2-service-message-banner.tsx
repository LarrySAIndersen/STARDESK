import Link from "next/link";
import { AlertCircle, Star } from "lucide-react";

import type { Kp2ServiceMessage } from "@/lib/kundeportal-2/types";
import { KP2_BASE } from "@/lib/kundeportal-2/types";

export function Kp2ServiceMessageBanner({ message }: { message: Kp2ServiceMessage }) {
  const isNews = message.tone === "news";

  return (
    <aside
      className={`kp2-message-banner${isNews ? " kp2-message-banner--news" : ""}`}
      aria-labelledby="kp2-message-heading"
    >
      <div className="kp2-message-banner-header">
        {isNews ? (
          <Star className="size-4 shrink-0 fill-current" aria-hidden />
        ) : (
          <AlertCircle className="size-4 shrink-0" aria-hidden />
        )}
        <h2 id="kp2-message-heading" className="text-sm font-semibold">
          {message.bannerLabel}
        </h2>
      </div>
      <Link
        href={`${KP2_BASE}/driftsmeddelelse/${message.id}`}
        className="kp2-message-banner-link"
      >
        {isNews && message.heroImage ? (
          <img
            src={message.heroImage}
            alt=""
            className="kp2-message-banner-thumb mb-2 w-full rounded-sm"
          />
        ) : null}
        <p className="font-semibold">{message.title}</p>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{message.summary}</p>
        {isNews ? (
          <p className="mt-2 text-xs font-medium text-[var(--kp2-turkis)]">Læs nyheden →</p>
        ) : null}
      </Link>
    </aside>
  );
}
