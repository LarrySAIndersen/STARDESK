type GaugeProps = {
  label: string;
  value: number;
  max: number;
  unit?: string;
  hint?: string;
  accent?: "blue" | "navy" | "red" | "green";
};

const ACCENT: Record<NonNullable<GaugeProps["accent"]>, string> = {
  blue: "#3b5a95",
  navy: "#003366",
  red: "#a51d36",
  green: "#047857",
};

/** Semicircle track: left (28,92) → top → right (172,92), center ~(100,92), r=72 */
const ARC_D = "M 28 92 A 72 72 0 0 1 172 92";

export function Gauge({
  label,
  value,
  max,
  unit = "",
  hint,
  accent = "blue",
}: GaugeProps) {
  const safeMax = Math.max(max, 1);
  const pct = Math.min(Math.max(value / safeMax, 0), 1);
  const stroke = ACCENT[accent];
  const display = `${Math.round(value)}${unit}`;

  return (
    <figure
      className="flex h-full w-full min-w-0 flex-col items-center justify-between gap-2"
      aria-label={`${label}: ${display}`}
    >
      <div className="relative mx-auto w-full max-w-[200px]" aria-hidden="true">
        <svg viewBox="0 0 200 110" className="block w-full" role="img" aria-hidden="true">
          <path
            d={ARC_D}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="12"
            strokeLinecap="round"
          />
          <path
            d={ARC_D}
            fill="none"
            stroke={stroke}
            strokeWidth="12"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${pct * 100} 100`}
          />
        </svg>
        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
          <span
            className="text-2xl font-bold tabular-nums leading-none"
            style={{ color: stroke }}
          >
            {display}
          </span>
        </div>
      </div>
      <div className="flex w-full flex-col items-center gap-0.5 text-center">
        <figcaption className="text-star-navy text-sm font-semibold leading-snug">
          {label}
        </figcaption>
        {hint ? (
          <p className="text-muted-foreground max-w-[14rem] text-xs leading-snug">
            {hint}
          </p>
        ) : null}
      </div>
    </figure>
  );
}
