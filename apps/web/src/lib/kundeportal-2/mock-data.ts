import type {
  Kp2CaseRow,
  Kp2MonthlyStatRow,
  Kp2ServiceMessage,
  Kp2Tile,
} from "@/lib/kundeportal-2/types";
import { KP2_BASE } from "@/lib/kundeportal-2/types";

export const KP2_FEATURED_TILES: Kp2Tile[] = [
  {
    id: "mine-sager",
    title: "Mine Sager (simpel)",
    href: `${KP2_BASE}/mine-sager`,
    icon: "list-checks",
    featured: true,
  },
  {
    id: "mine-sager-udvidet",
    title: "Mine sager (udvidet)",
    href: `${KP2_BASE}/mine-sager/udvidet`,
    icon: "layout-list",
    featured: true,
  },
  {
    id: "sager-aar",
    title: "Sager - År",
    href: `${KP2_BASE}/statistik?vis=aar`,
    icon: "bar-chart",
    featured: true,
  },
  {
    id: "sager-maaned",
    title: "Sager - Måned",
    href: `${KP2_BASE}/statistik?vis=maaned`,
    icon: "bar-chart-2",
    featured: true,
  },
  {
    id: "fejl-produktion",
    title: "Fejl Produktion",
    href: `${KP2_BASE}/service-requests/fejl-produktion`,
    icon: "alert-circle",
    featured: true,
  },
  {
    id: "fejl-test",
    title: "Fejl Testmiljø",
    href: `${KP2_BASE}/service-requests/fejl-testmiljo`,
    icon: "bug",
    featured: true,
  },
  {
    id: "spoergsmaal",
    title: "Spørgsmål",
    href: `${KP2_BASE}/service-requests/sporgsmaal`,
    icon: "help-circle",
    featured: true,
  },
  {
    id: "aendring",
    title: "Ændring",
    href: `${KP2_BASE}/service-requests/aendring`,
    icon: "git-branch",
    featured: true,
  },
  {
    id: "katalog",
    title: "Service Requests & Changes",
    href: `${KP2_BASE}/service-requests`,
    icon: "folder-open",
    featured: true,
  },
];

export const KP2_SERVICE_MESSAGES: Kp2ServiceMessage[] = [
  {
    id: "omfattende-serviceafbrydelse",
    title: "Udfordringer med TOPdesk-adviseringer",
    summary:
      "Vi oplever udfordringer med at adviseringer om sager ikke altid sendes korrekt. Svartider kan være længere end normalt.",
    status: "behandler",
    type: "Incident",
    categorization: "Middleware - Topdesk",
    registeredAt: "2025-11-27T10:29:00",
    updates: [
      {
        id: "u1",
        author: "Ansvarlig",
        createdAt: "2025-12-11T15:44:00",
        body: "Teknisk rettelse er planlagt i næste vedligeholdelsesvindue.",
      },
      {
        id: "u2",
        author: "Ansvarlig",
        createdAt: "2026-01-28T09:15:00",
        body: "Delvis løsning er udrullet. Vi overvåger adviseringer tæt.",
      },
      {
        id: "u3",
        author: "Ansvarlig",
        createdAt: "2026-02-04T11:00:00",
        body: "Yderligere fejlsøgning pågår i samarbejde med leverandør.",
      },
      {
        id: "u4",
        author: "Ansvarlig",
        createdAt: "2026-02-12T14:30:00",
        body: "Status uændret — brug portalen til at følge sager manuelt indtil videre.",
      },
    ],
  },
];

export const KP2_MOCK_CASES: Kp2CaseRow[] = [
  {
    id: "c1",
    number: "SR-2026-00421",
    title: "Adgang til testmiljø T3",
    type: "service_request",
    status: "in_progress",
    priority: "medium",
    createdAt: "2026-06-01T08:12:00",
    requester: "Jan Kjærby Vinding",
  },
  {
    id: "c2",
    number: "INC-2026-00118",
    title: "Printer fejl - Kan ikke printe",
    type: "incident",
    status: "assigned",
    priority: "high",
    createdAt: "2026-05-28T14:05:00",
    requester: "Jan Kjærby Vinding",
  },
  {
    id: "c3",
    number: "CHG-2026-00087",
    title: "Release 2025-3 deployment",
    type: "change",
    status: "resolved",
    priority: "low",
    createdAt: "2026-05-15T09:00:00",
    requester: "Afdelingen",
  },
];

export const KP2_MONTHLY_STATS: Kp2MonthlyStatRow[] = [
  { period: "2024-01", registeredSecondLine: 42, resolvedSecondLine: 38 },
  { period: "2024-02", registeredSecondLine: 35, resolvedSecondLine: 33 },
  { period: "2024-03", registeredSecondLine: 48, resolvedSecondLine: 45 },
  { period: "2025-01", registeredSecondLine: 51, resolvedSecondLine: 49 },
  { period: "2025-02", registeredSecondLine: 44, resolvedSecondLine: 41 },
  { period: "2025-03", registeredSecondLine: 57, resolvedSecondLine: 52 },
  { period: "2026-01", registeredSecondLine: 39, resolvedSecondLine: 36 },
  { period: "2026-02", registeredSecondLine: 46, resolvedSecondLine: 44 },
  { period: "2026-03", registeredSecondLine: 53, resolvedSecondLine: 50 },
  { period: "2026-04", registeredSecondLine: 41, resolvedSecondLine: 40 },
  { period: "2026-05", registeredSecondLine: 58, resolvedSecondLine: 55 },
  { period: "2026-06", registeredSecondLine: 22, resolvedSecondLine: 18 },
];

export function formatKp2Date(iso: string): string {
  return new Intl.DateTimeFormat("da-DK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}
