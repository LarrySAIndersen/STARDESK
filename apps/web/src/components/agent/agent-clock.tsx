"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

const CLOCK_TIMEZONE = "Europe/Copenhagen";

function formatCopenhagenClock(now: Date): string {
  return new Intl.DateTimeFormat("da-DK", {
    timeZone: CLOCK_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now);
}

/** Live wall clock (Copenhagen) so agents trust SLA timers. */
export function AgentClock({ className }: { className?: string }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!now) {
    return null;
  }

  return (
    <time
      dateTime={now.toISOString()}
      className={cn(
        "text-muted-foreground hidden items-baseline gap-1.5 font-mono text-xs tabular-nums sm:inline-flex",
        className,
      )}
      aria-label={`Klokken ${formatCopenhagenClock(now)}`}
    >
      <span className="font-sans text-[10px] font-medium tracking-wide uppercase">Klokken</span>
      <span className="text-foreground font-semibold">{formatCopenhagenClock(now)}</span>
    </time>
  );
}
