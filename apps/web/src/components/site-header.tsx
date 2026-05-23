import { cookies } from "next/headers";
import Link from "next/link";

import { SiteHeaderNav } from "@/components/site-header-nav";
import { StarLogo } from "@/components/star-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { TOKEN_COOKIE } from "@/lib/auth";
import { getServerUser } from "@/lib/auth-server";
import { cn } from "@/lib/utils";
import type { User } from "@/types/user";

type SiteHeaderProps = {
  /** Dark industrial shell for forced first-time password change. */
  shellVariant?: "default" | "firstLoginIndustrial";
  /** Hide Sager + Opret sag (e.g. while `must_change_password`). */
  hideCasesAndNewTicketNav?: boolean;
  /** Session user from server (avoids relying on `document.cookie` alone). */
  user?: User | null;
};

export async function SiteHeader({
  shellVariant = "default",
  hideCasesAndNewTicketNav = false,
  user: userProp,
}: SiteHeaderProps) {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  const isAuthenticated = Boolean(token);
  const user = userProp ?? (isAuthenticated ? await getServerUser() : null);
  const industrial = shellVariant === "firstLoginIndustrial";

  return (
    <header className={cn("sticky top-0 z-50", industrial ? "shadow-md shadow-black/40" : "shadow-sm")}>
      <div
        className={cn(
          industrial
            ? "border-b border-white/[0.08] bg-[#0a0e1a] text-[#94a3b8]"
            : "bg-star-navy text-white dark:border-b dark:border-border dark:bg-[#0c1018] dark:text-muted-foreground",
        )}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-1.5 text-xs">
          <span
            className={
              industrial ? "text-[#94a3b8]" : "text-white/90 dark:text-muted-foreground"
            }
          >
            STARdesk — ITSM prototype
          </span>
          <span
            className={cn(
              "hidden sm:inline",
              industrial ? "text-[#64748b]" : "text-white/90 dark:text-muted-foreground",
            )}
          >
            STARdesk
          </span>
        </div>
      </div>

      <div
        className={cn(
          "border-b",
          industrial
            ? "border-white/[0.08] bg-[#0a0e1a]"
            : "border-border bg-card text-card-foreground",
        )}
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="group flex items-center gap-3">
            <StarLogo priority inverted={industrial} />
            <div>
              <span
                className={cn(
                  "block text-xl font-bold leading-tight tracking-tight",
                  industrial ? "text-white" : "text-star-navy dark:text-foreground",
                )}
              >
                STARdesk
              </span>
              <span
                className={cn(
                  "block text-xs font-medium",
                  industrial ? "text-[#E8501A]" : "text-star-blue dark:text-primary",
                )}
              >
                Sagsstyring og self-service
              </span>
            </div>
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            {isAuthenticated ? (
              <SiteHeaderNav
                user={user}
                hideCasesAndNewTicket={hideCasesAndNewTicketNav}
                industrialChrome={industrial}
              />
            ) : (
              <ThemeToggle />
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
