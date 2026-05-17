import Link from "next/link";

import { StarLogo } from "@/components/star-logo";

export function AgentBrandHeader() {
  return (
    <header className="border-border bg-card sticky top-0 z-50 shrink-0 border-b shadow-sm">
      <div className="bg-star-navy text-white">
        <div className="flex items-center justify-between px-6 py-1.5 text-xs">
          <span className="text-white/90">
            Styrelsen for Arbejdsmarked og Rekruttering — ITSM prototype
          </span>
          <span className="hidden text-white/90 sm:inline">STARdesk</span>
        </div>
      </div>

      <div className="px-6 py-3">
        <Link href="/" className="group inline-flex max-w-full items-center gap-3">
          <StarLogo priority className="transition-opacity group-hover:opacity-90" />
          <div className="min-w-0">
            <span className="text-star-navy dark:text-foreground block truncate text-xl font-bold leading-tight tracking-tight">
              STARdesk
            </span>
            <span className="text-star-blue dark:text-primary block truncate text-xs font-medium">
              Sagsstyring og self-service
            </span>
          </div>
        </Link>
      </div>
    </header>
  );
}
