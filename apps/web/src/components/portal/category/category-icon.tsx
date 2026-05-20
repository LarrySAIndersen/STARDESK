import {
  Badge,
  Building2,
  Calendar,
  DoorOpen,
  Download,
  FileText,
  Folder,
  HelpCircle,
  Key,
  Laptop,
  Mail,
  Monitor,
  Package,
  PlusCircle,
  Printer,
  UserPlus,
  Users,
  Wallet,
  Wifi,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  monitor: Monitor,
  users: Users,
  building: Building2,
  folder: Folder,
  laptop: Laptop,
  "help-circle": HelpCircle,
  key: Key,
  download: Download,
  wifi: Wifi,
  mail: Mail,
  "user-plus": UserPlus,
  calendar: Calendar,
  wallet: Wallet,
  "file-text": FileText,
  "door-open": DoorOpen,
  printer: Printer,
  package: Package,
  badge: Badge,
  "plus-circle": PlusCircle,
};

export function CategoryIcon({
  name,
  className,
  size = 24,
}: {
  name: string;
  className?: string;
  size?: number;
}) {
  const Icon = ICONS[name] ?? Folder;
  return <Icon className={cn("shrink-0", className)} size={size} aria-hidden />;
}
