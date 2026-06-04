import Link from "next/link";

import { cn } from "@/lib/utils";
import type { DailyCount } from "@/types/dashboard";

function formatDayLabel(isoDate: string): string {
  const date = new Date(isoDate + "T12:00:00");
  return new Intl.DateTimeFormat("da-DK", { weekday: "short", day: "numeric" }).format(date);
}

export function TrendChart({
  title,
  created,
  closed,
  getCreatedHref,
  getClosedHref,
}: {
  title: string;
  created: DailyCount[];
  closed: DailyCount[];
  getCreatedHref?: (day: DailyCount) => string | undefined;
  getClosedHref?: (day: DailyCount) => string | undefined;
}) {
  const maxCount = Math.max(
    1,
    ...created.map((d) => d.count),
    ...closed.map((d) => d.count),
  );

  return (
    <section aria-labelledby="trend-chart-title" className="star-section-card p-6">
      <h3 id="trend-chart-title" className="text-star-navy text-base font-bold">
        {title}
      </h3>
      <p className="text-muted-foreground mt-1 text-xs">Seneste 14 dage</p>

      <div className="mt-4 flex flex-wrap gap-4 text-xs">
        <span className="flex items-center gap-2">
          <span className="bg-star-blue inline-block h-3 w-3 rounded-sm" aria-hidden />
          Oprettet
        </span>
        <span className="flex items-center gap-2">
          <span className="bg-emerald-600 inline-block h-3 w-3 rounded-sm" aria-hidden />
          Lukket
        </span>
      </div>

      <div
        className="mt-4 flex items-end gap-1 overflow-x-auto pb-2"
        role="img"
        aria-label="Søjlediagram for oprettede og lukkede sager"
      >
        {created.map((day, index) => {
          const closedDay = closed[index];
          const createdHeight = (day.count / maxCount) * 100;
          const closedHeight = ((closedDay?.count ?? 0) / maxCount) * 100;
          const createdHref = getCreatedHref?.(day);
          const closedHref = closedDay ? getClosedHref?.(closedDay) : undefined;

          const createdBar = (
            <div
              className="bg-star-blue w-[42%] rounded-t-sm transition-all"
              style={{ height: `${Math.max(createdHeight, day.count > 0 ? 8 : 0)}%` }}
              title={`Oprettet: ${day.count}`}
            />
          );
          const closedBar = (
            <div
              className="bg-emerald-600 w-[42%] rounded-t-sm transition-all"
              style={{
                height: `${Math.max(closedHeight, (closedDay?.count ?? 0) > 0 ? 8 : 0)}%`,
              }}
              title={`Lukket: ${closedDay?.count ?? 0}`}
            />
          );

          return (
            <div
              key={day.date}
              className="flex min-w-[2.25rem] flex-1 flex-col items-center gap-1"
            >
              <div className="flex h-28 w-full items-end justify-center gap-0.5">
                {createdHref && day.count > 0 ? (
                  <Link
                    href={createdHref}
                    className={cn(
                      "flex h-full w-[42%] items-end justify-center",
                      "hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-star-blue",
                    )}
                    aria-label={`Oprettet ${formatDayLabel(day.date)}: ${day.count}`}
                  >
                    {createdBar}
                  </Link>
                ) : (
                  createdBar
                )}
                {closedHref && (closedDay?.count ?? 0) > 0 ? (
                  <Link
                    href={closedHref}
                    className={cn(
                      "flex h-full w-[42%] items-end justify-center",
                      "hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-star-blue",
                    )}
                    aria-label={`Lukket ${formatDayLabel(closedDay!.date)}: ${closedDay!.count}`}
                  >
                    {closedBar}
                  </Link>
                ) : (
                  closedBar
                )}
              </div>
              <span className="text-muted-foreground text-[10px] leading-tight">
                {formatDayLabel(day.date)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
