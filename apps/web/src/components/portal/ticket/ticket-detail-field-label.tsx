import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Clock,
  Folder,
  FolderTree,
  Inbox,
  Layers,
  Signal,
  User,
  UserCircle,
  Users,
} from "lucide-react";

const TICKET_DETAIL_FIELD_ICONS: Record<string, LucideIcon> = {
  status: Activity,
  ticket_type: Layers,
  category: Folder,
  subcategory: FolderTree,
  team: Users,
  assignee: User,
  priority: Signal,
  source: Inbox,
  reporter: UserCircle,
  sla: Clock,
};

export function TicketDetailFieldLabel({
  fieldId,
  label,
  className,
}: {
  fieldId: string;
  label: string;
  className?: string;
}) {
  const Icon = TICKET_DETAIL_FIELD_ICONS[fieldId];
  return (
    <span className={className ?? "text-muted-foreground flex items-center gap-1.5 font-medium"}>
      {Icon ? (
        <Icon className="text-star-blue size-3.5 shrink-0 opacity-80" aria-hidden />
      ) : null}
      {label}
    </span>
  );
}
