"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type HealthState =
  | { status: "checking" }
  | { status: "ok" }
  | { status: "degraded"; message: string; detail?: string }
  | { status: "error"; message: string; detail?: string };

async function probeHealth(url: string): Promise<Response> {
  return fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
}

/** Shows a header warning when the web app or Vercel API backend is unreachable. */
export function ApiHealthIndicator({ className }: { className?: string }) {
  const [health, setHealth] = useState<HealthState>({ status: "checking" });

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const [webRes, backendRes] = await Promise.all([
          probeHealth("/api/health"),
          probeHealth("/api/backend-health"),
        ]);

        if (cancelled) return;

        if (!webRes.ok) {
          setHealth({
            status: "error",
            message: "Webapp: Driftstilstand",
            detail: `Webappen svarer med HTTP ${webRes.status}.`,
          });
          return;
        }

        if (!backendRes.ok) {
          let detail = `API svarer med HTTP ${backendRes.status}.`;
          try {
            const body = (await backendRes.json()) as { detail?: string };
            if (body.detail) {
              detail = body.detail;
            }
          } catch {
            // ignore parse errors
          }
          setHealth({
            status: "error",
            message: "API: Driftstilstand",
            detail: `${detail} Tjek at API-backend kører på Vercel og at NEXT_PUBLIC_API_URL er korrekt.`,
          });
          return;
        }

        const backendBody = (await backendRes.json()) as { status?: string; detail?: string };
        if (backendBody.status !== "ok") {
          setHealth({
            status: "degraded",
            message: "API: Nedsat drift",
            detail: backendBody.detail ?? "Backend rapporterer nedsat drift.",
          });
          return;
        }

        setHealth({ status: "ok" });
      } catch (error) {
        if (cancelled) return;
        setHealth({
          status: "error",
          message: "API: Driftstilstand",
          detail:
            error instanceof Error
              ? error.message
              : "Kunne ikke kontakte API. Tjek netværk og backend.",
        });
      }
    }

    void check();
    const intervalId = window.setInterval(() => void check(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  if (health.status === "checking" || health.status === "ok") {
    return null;
  }

  return (
    <div
      className={cn(
        "flex max-w-xs items-center gap-1.5 rounded-sm border border-amber-300/80 bg-amber-50 px-2 py-1 text-amber-900",
        className,
      )}
      role="status"
      title={health.detail}
    >
      <AlertTriangle className="size-4 shrink-0 text-amber-600" aria-hidden />
      <span className="truncate text-xs font-medium">{health.message}</span>
    </div>
  );
}
