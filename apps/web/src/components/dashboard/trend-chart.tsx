import type { DailyCount } from "@/types/dashboard";

function formatDayLabel(isoDate: string): string {
  const date = new Date(isoDate + "T12:00:00");
  return new Intl.DateTimeFormat("da-DK", { weekday: "short", day: "numeric" }).format(date);
}

export function TrendChart({
  title,
  created,
  closed,
}: {
  title: string;
  created: DailyCount[];
  closed: DailyCount[];
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
          return (
            <div
              key={day.date}
              className="flex min-w-[2.25rem] flex-1 flex-col items-center gap-1"
            >
              <div className="flex h-28 w-full items-end justify-center gap-0.5">
                <div
                  className="bg-star-blue w-[42%] rounded-t-sm transition-all"
                  style={{ height: `${Math.max(createdHeight, day.count > 0 ? 8 : 0)}%` }}
                  title={`Oprettet: ${day.count}`}
                />
                <div
                  className="bg-emerald-600 w-[42%] rounded-t-sm transition-all"
                  style={{
                    height: `${Math.max(closedHeight, (closedDay?.count ?? 0) > 0 ? 8 : 0)}%`,
                  }}
                  title={`Lukket: ${closedDay?.count ?? 0}`}
                />
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
