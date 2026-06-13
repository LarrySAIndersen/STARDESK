import type { Ticket } from "@/types/ticket";

/** Classic module ids — classic ITSM-style navigation (same DB, different presentation). */
export type ClassicModuleId =
  | "home"
  | "incidents"
  | "changes"
  | "problems"
  | "service-requests"
  | "my-work";

export type ClassicModuleDef = {
  id: ClassicModuleId;
  href: string;
  label: string;
  /** Danish subtitle shown under module title */
  subtitle: string;
  /** Filter tickets from shared list API (client-side until API adds ticket_type query). */
  match: (ticket: Ticket) => boolean;
};

export const CLASSIC_MODULES: ClassicModuleDef[] = [
  {
    id: "incidents",
    href: "/classic/incidents",
    label: "Incidents",
    subtitle: "Hændelser og driftsforstyrrelser",
    match: (t) => t.ticket_type === "incident",
  },
  {
    id: "changes",
    href: "/classic/changes",
    label: "Changes",
    subtitle: "Ændringer (service requests indtil change-domæne findes)",
    match: (t) => t.ticket_type === "service_request",
  },
  {
    id: "problems",
    href: "/classic/problems",
    label: "Problems",
    subtitle: "Problemregistrering og known errors",
    match: (t) => t.ticket_type === "problem",
  },
  {
    id: "service-requests",
    href: "/classic/service-requests",
    label: "Service requests",
    subtitle: "Anmodninger og bestillinger",
    match: (t) => t.ticket_type === "service_request",
  },
];

export function classicModuleBySegment(segment: string): ClassicModuleDef | undefined {
  return CLASSIC_MODULES.find((m) => m.href === `/classic/${segment}`);
}
