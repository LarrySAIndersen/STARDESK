import { displayStatusAbbrev, displayStatusLabel } from "@/lib/integrations-config";
import { cn } from "@/lib/utils";
import type { IntegrationDisplayStatus } from "@/types/integration";

const VARIANT: Record<IntegrationDisplayStatus, string> = {
  active: "wire-integ-pill--active",
  inactive: "wire-integ-pill--inactive",
  draft: "wire-integ-pill--draft",
};

export function IntegrationStatusPill({
  status,
  label,
  compact = false,
  className,
}: {
  status: IntegrationDisplayStatus;
  /** Override label (e.g. Slack "Konfigureret"). */
  label?: string;
  /** Abbreviated label for the compact collapsed nav rail. */
  compact?: boolean;
  className?: string;
}) {
  const fullLabel = label ?? displayStatusLabel(status);
  const shown = compact
    ? (label ? label.slice(0, 3) : displayStatusAbbrev(status))
    : fullLabel;

  return (
    <span
      className={cn("wire-integ-pill", VARIANT[status], compact && "wire-integ-pill--compact", className)}
      title={fullLabel}
    >
      {shown}
    </span>
  );
}
