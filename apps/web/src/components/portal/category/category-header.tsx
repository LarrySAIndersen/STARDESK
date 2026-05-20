import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { CategoryIcon } from "@/components/portal/category/category-icon";
export function CategoryHeader({
  nameDa,
  description,
  icon,
  articleCount,
  serviceCount,
  openTicketCount,
}: {
  nameDa: string;
  description: string;
  icon: string;
  articleCount: number;
  serviceCount: number;
  openTicketCount: number;
}) {
  return (
    <header className="portal-v2-section space-y-4">
      <nav className="portal-v2-breadcrumb text-[12px]" aria-label="Brødkrumme">
        <Link href="/portal" className="portal-v2-breadcrumb-link">
          Oversigt
        </Link>
        <ChevronRight className="size-3.5 opacity-50" aria-hidden />
        <span className="text-star-navy font-medium">{nameDa}</span>
      </nav>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
        <div
          className="bg-star-navy/8 text-star-navy flex size-12 shrink-0 items-center justify-center rounded-[2px] border border-star-navy/10"
          aria-hidden
        >
          <CategoryIcon name={icon} size={26} />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <h1 className="text-star-navy text-2xl font-bold tracking-tight sm:text-[28px]">
            {nameDa}
          </h1>
          <p className="text-[var(--gray-mid)] max-w-2xl text-[14px] leading-relaxed">
            {description}
          </p>
          <ul
            className="text-[var(--gray-mid)] flex flex-wrap gap-x-4 gap-y-1 text-[12px]"
            aria-label="Statistik"
          >
            <li>
              <span className="text-star-navy font-semibold tabular-nums">{articleCount}</span>{" "}
              artikler
            </li>
            <li aria-hidden>·</li>
            <li>
              <span className="text-star-navy font-semibold tabular-nums">{serviceCount}</span>{" "}
              services
            </li>
            {openTicketCount > 0 ? (
              <>
                <li aria-hidden>·</li>
                <li>
                  <span className="text-star-navy font-semibold tabular-nums">
                    {openTicketCount}
                  </span>{" "}
                  åbne afdelingssager
                </li>
              </>
            ) : null}
          </ul>
        </div>
      </div>
    </header>
  );
}
