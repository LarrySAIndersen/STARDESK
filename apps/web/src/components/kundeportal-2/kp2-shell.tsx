"use client";



import Link from "next/link";

import { usePathname } from "next/navigation";

import type { ReactNode } from "react";



import { HistoryBackButton } from "@/components/navigation/history-back-button";
import { getClientUser, isStaff } from "@/lib/auth";
import { KP2_BASE } from "@/lib/kundeportal-2/types";

import { cn } from "@/lib/utils";



const SEGMENT_LABELS: Record<string, string> = {

  "mine-sager": "Mine sager",

  udvidet: "Udvidet",

  statistik: "Statistik",

  "service-requests": "Service Requests & Changes",

  driftsmeddelelse: "Driftsmeddelelse",

  kvittering: "Kvittering",

  soeg: "Søg",

};



function buildBreadcrumbs(pathname: string): { href: string; label: string }[] {

  const crumbs = [{ href: KP2_BASE, label: "Kundeportal #2" }];

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

  const showBreadcrumbs = crumbs.length > 1;
  const showBackButton = isStaff(getClientUser());



  return (

    <div className={cn("kp2-app min-h-0", showBreadcrumbs && "kp2-app--subpage")}>

      {(showBackButton || showBreadcrumbs) ? (
      <div className="mb-3 flex flex-wrap items-center gap-3">
        {showBackButton ? <HistoryBackButton /> : null}
        {showBreadcrumbs ? (

        <nav className="portal-v2-breadcrumb mb-4" aria-label="Brødkrumme">

          {crumbs.map((crumb, index) => {

            const isLast = index === crumbs.length - 1;

            return (

              <span key={crumb.href} className="inline-flex items-center gap-1.5">

                {index > 0 ? <span aria-hidden className="text-muted-foreground/60">/</span> : null}

                {isLast ? (

                  <span className="text-foreground font-medium">{crumb.label}</span>

                ) : (

                  <Link href={crumb.href} className="portal-v2-breadcrumb-link">

                    {crumb.label}

                  </Link>

                )}

              </span>

            );

          })}

        </nav>
        ) : null}
      </div>
      ) : null}

      <div id="main-content">{children}</div>

    </div>

  );

}

