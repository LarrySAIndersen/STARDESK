import { displayStatusLabel } from "@/lib/integrations-config";
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
  className,
}: {
  status: IntegrationDisplayStatus;
  /** Override label (e.g. Slack "Konfigureret"). */
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn("wire-integ-pill", VARIANT[status], className)}
      title={label ?? displayStatusLabel(status)}
    >
      {label ?? displayStatusLabel(status)}
    </span>
  );
}
