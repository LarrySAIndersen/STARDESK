import type { LucideIcon } from "lucide-react";
import {
  ClipboardList,
  Columns3,
  Headset,
  Inbox,
  Plus,
  Ticket,
} from "lucide-react";

export type ProjekterHubItem = {
  id: string;
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  accentSoft: string;
};

/** Core project tools surfaced on /projekter. */
export const PROJEKTER_HUB_ITEMS: ProjekterHubItem[] = [
  {
    id: "kanban",
    href: "/kanban",
    label: "Kanban",
    description: "Boards med kolonner — træk sager på tværs af status.",
    icon: Columns3,
    accent: "#1a5fb4",
    accentSoft: "#e8f1fb",
  },
  {
    id: "workboard",
    href: "/workboard",
    label: "Opgaver til senere",
    description: "Online backlog — gem og prioriter opgaver til senere.",
    icon: ClipboardList,
    accent: "#6b4c9a",
    accentSoft: "#f0ebf8",
  },
  {
    id: "backlog",
    href: "/backlog",
    label: "Backlog",
    description: "Modtagede sager i kø — planlæg og prioriter arbejde.",
    icon: Inbox,
    accent: "#0d7377",
    accentSoft: "#e6f4f4",
  },
  {
    id: "tickets",
    href: "/tickets",
    label: "Alle sager",
    description: "Fuld sagliste med filtre og søgning.",
    icon: Ticket,
    accent: "#5c4d9e",
    accentSoft: "#eceaf5",
  },
  {
    id: "tickets-new",
    href: "/tickets/new",
    label: "Ny sag",
    description: "Opret en ny sag eller historie i projektet.",
    icon: Plus,
    accent: "#c9a227",
    accentSoft: "#faf4e3",
  },
  {
    id: "service-desk",
    href: "/service-desk",
    label: "Service Desk",
    description: "Kø og tildeling for teamets indkommende arbejde.",
    icon: Headset,
    accent: "#c41e2a",
    accentSoft: "#fce8ea",
  },
];

export function filterProjekterHubItems(query: string): ProjekterHubItem[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return PROJEKTER_HUB_ITEMS;
  }
  return PROJEKTER_HUB_ITEMS.filter(
    (item) =>
      item.label.toLowerCase().includes(needle) ||
      item.description.toLowerCase().includes(needle) ||
      item.href.toLowerCase().includes(needle),
  );
}
