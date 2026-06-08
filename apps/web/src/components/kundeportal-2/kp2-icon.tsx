import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  BarChart,
  BarChart2,
  Bug,
  Database,
  Download,
  FlaskConical,
  FolderOpen,
  GitBranch,
  Globe,
  HelpCircle,
  Key,
  LayoutList,
  ListChecks,
  LogIn,
  LogOut,
  Shield,
  Table,
  UserPlus,
  Users,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  "list-checks": ListChecks,
  "layout-list": LayoutList,
  "bar-chart": BarChart,
  "bar-chart-2": BarChart2,
  "alert-circle": AlertCircle,
  bug: Bug,
  "help-circle": HelpCircle,
  "git-branch": GitBranch,
  "folder-open": FolderOpen,
  "user-plus": UserPlus,
  key: Key,
  database: Database,
  download: Download,
  flask: FlaskConical,
  shield: Shield,
  certificate: Shield,
  globe: Globe,
  "log-in": LogIn,
  "log-out": LogOut,
  table: Table,
  users: Users,
};

export function Kp2Icon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? HelpCircle;
  return <Icon className={className} aria-hidden />;
}
