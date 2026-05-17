import { cookies } from "next/headers";
import Link from "next/link";

import { SiteHeaderNav } from "@/components/site-header-nav";
import { StarLogo } from "@/components/star-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { TOKEN_COOKIE } from "@/lib/auth";

export async function SiteHeader() {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  const isAuthenticated = Boolean(token);
  return (
    <header className="sticky top-0 z-50 shadow-sm">
      <div className="bg-star-navy text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-1.5 text-xs">
          <span className="text-white/90">
            Styrelsen for Arbejdsmarked og Rekruttering — ITSM prototype
          </span>
          <span className="hidden text-white/90 sm:inline">STARdesk</span>
        </div>
      </div>

      <div className="border-border border-b bg-white dark:bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="group flex items-center gap-3">
            <StarLogo priority className="transition-opacity group-hover:opacity-90" />
            <div>
              <span className="text-star-navy dark:text-foreground block text-xl font-bold leading-tight tracking-tight">
                STARdesk
              </span>
              <span className="text-star-blue dark:text-primary block text-xs font-medium">
                Sagsstyring og self-service
              </span>
            </div>
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            {isAuthenticated ? <SiteHeaderNav /> : <ThemeToggle />}
          </div>
        </div>
      </div>
    </header>
  );
}
