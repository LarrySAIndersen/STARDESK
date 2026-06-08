"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { Kp2Header } from "@/components/kundeportal-2/kp2-header";
import { KP2_BASE } from "@/lib/kundeportal-2/types";
import { cn } from "@/lib/utils";

const SEGMENT_LABELS: Record<string, string> = {
  "mine-sager": "Mine sager",
  udvidet: "Udvidet",
  statistik: "Statistik",
  "service-requests": "Service Requests & Changes",
  driftsmeddelelse: "Driftsmeddelelse",
  kvittering: "Kvittering",
};

function buildBreadcrumbs(pathname: string): { href: string; label: string }[] {
  const crumbs = [{ href: KP2_BASE, label: "Forside" }];
  if (pathname === KP2_BASE) return crumbs;

  const rest = pathname.replace(`${KP2_BASE}/`, "").split("/").filter(Boolean);
  let acc = KP2_BASE;
  for (const segment of rest) {
    acc = `${acc}/${segment}`;
    const label =
      SEGMENT_LABELS[segment] ??
      segment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    crumbs.push({ href: acc, label });
  }
  return crumbs;
}

export function Kp2Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const crumbs = buildBreadcrumbs(pathname);

  return (
    <div className="kp2-app flex min-h-dvh flex-col">
      <Kp2Header />
      {crumbs.length > 1 ? (
        <nav className="kp2-breadcrumbs" aria-label="Brødkrumme">
          {crumbs.map((crumb, index) => {
            const isLast = index === crumbs.length - 1;
            return (
              <span key={crumb.href} className="inline-flex items-center gap-1.5">
                {index > 0 ? <span aria-hidden>/</span> : null}
                {isLast ? (
                  <span className="font-medium text-foreground">{crumb.label}</span>
                ) : (
                  <Link href={crumb.href} className="kp2-breadcrumb-link">
                    {crumb.label.toUpperCase()}
                  </Link>
                )}
              </span>
            );
          })}
        </nav>
      ) : null}
      <main id="main-content" className={cn("kp2-main flex-1")}>
        {children}
      </main>
    </div>
  );
}
