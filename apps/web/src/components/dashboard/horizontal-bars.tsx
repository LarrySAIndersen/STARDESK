import Link from "next/link";

import { cn } from "@/lib/utils";
import type { CountByLabel } from "@/types/dashboard";

const BAR_COLORS = [
  "bg-star-blue",
  "bg-star-navy",
  "bg-emerald-600",
  "bg-amber-500",
  "bg-star-red",
  "bg-slate-400",
];

export function HorizontalBars({
  title,
  items,
  id,
  getItemHref,
}: {
  title: string;
  items: CountByLabel[];
  id: string;
  getItemHref?: (item: CountByLabel) => string | undefined;
}) {
  const max = Math.max(1, ...items.map((i) => i.count));

  return (
    <section aria-labelledby={id} className="star-section-card p-6">
      <h3 id={id} className="text-star-navy text-base font-bold">
        {title}
      </h3>
      <ul className="mt-4 space-y-3" role="list">
        {items.length === 0 ? (
          <li className="text-muted-foreground text-sm">Ingen data</li>
        ) : (
          items.map((item, index) => {
            const widthPct = (item.count / max) * 100;
            const href = getItemHref?.(item);
            const row = (
              <>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-star-navy font-medium">{item.label_da}</span>
                  <span className="text-muted-foreground tabular-nums">{item.count}</span>
                </div>
                <div className="bg-muted h-2.5 overflow-hidden rounded-full">
                  <div
                    className={`${BAR_COLORS[index % BAR_COLORS.length]} h-full rounded-full transition-all`}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </>
            );
            return (
              <li key={item.key}>
                {href && item.count > 0 ? (
                  <Link
                    href={href}
                    className={cn(
                      "block rounded-md transition-shadow",
                      "hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-star-blue",
                    )}
                    aria-label={`${item.label_da}: ${item.count} sager`}
                  >
                    {row}
                  </Link>
                ) : (
                  row
                )}
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}
