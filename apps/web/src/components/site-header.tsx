import Link from "next/link";

import { SiteHeaderNav } from "@/components/site-header-nav";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 shadow-sm">
      <div className="bg-star-navy text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-1.5 text-xs">
          <span className="text-white/90">
            Styrelsen for Arbejdsmarked og Rekruttering — ITSM prototype
          </span>
          <span className="hidden text-white/70 sm:inline">STARdesk</span>
        </div>
      </div>

      <div className="border-border border-b bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="group flex items-center gap-3">
            <div
              className="border-star-navy text-star-navy flex size-11 shrink-0 items-center justify-center rounded-full border-2 bg-white transition-colors group-hover:bg-star-blue-light"
              aria-hidden
            >
              <span className="text-lg leading-none">★</span>
            </div>
            <div>
              <span className="text-star-navy block text-xl font-bold leading-tight tracking-tight">
                STARdesk
              </span>
              <span className="text-star-blue block text-xs font-medium">
                Sagsstyring og self-service
              </span>
            </div>
          </Link>

          <SiteHeaderNav />
        </div>
      </div>
    </header>
  );
}
