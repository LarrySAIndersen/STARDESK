import Link from "next/link";

import { UserMenu } from "@/components/user-menu";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/", label: "Sager" },
  { href: "/reports", label: "Rapporter" },
  { href: "/groups", label: "Grupper" },
] as const;

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

          <nav className="flex flex-wrap items-center gap-1">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="star-nav-link">
                {item.label}
              </Link>
            ))}
            <Button
              nativeButton={false}
              render={<Link href="/tickets/new" />}
              className="bg-star-blue hover:bg-star-navy ml-2 rounded-sm px-4 font-semibold"
            >
              Opret sag
            </Button>
            <UserMenu />
          </nav>
        </div>
      </div>
    </header>
  );
}
