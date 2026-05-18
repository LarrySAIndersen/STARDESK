import { priorityLabel, statusLabel } from "@/lib/ticket-labels";
import {
  wirePriorityBadgeClass,
  wireStatusBadgeClass,
} from "@/lib/wireframe-labels";
import { cn } from "@/lib/utils";

export function WirePriorityBadge({ priority }: { priority: string }) {
  const variant = wirePriorityBadgeClass(priority);
  return (
    <span className={cn("wire-badge", `wire-badge--${variant}`)}>
      {priorityLabel(priority)}
    </span>
  );
}

export function WireStatusBadge({ status }: { status: string }) {
  const variant = wireStatusBadgeClass(status);
  return (
    <span className={cn("wire-badge", `wire-badge--${variant}`)}>
      {statusLabel(status)}
    </span>
  );
}
