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
    id: "stardesk-elsket-verden-over",
    bannerLabel: "Nyhed fra STARDESK",
    tone: "news",
    title: "Hele verden elsker STARDESK!",
    summary:
      "Fra København til Kap Town: millioner af brugere fejrer den nye selvbetjeningsportal. Se billederne og læs den globale succeshistorie.",
    status: "publiceret",
    type: "Nyhed",
    categorization: "Succeshistorier — STARDESK",
    registeredAt: "2026-06-09T08:00:00",
    heroImage: "/images/kp2-news/hero-world.svg",
    pullQuote:
      "STARDESK har forvandlet vores hverdag — hurtigere sager, smilende kolleger og stjerner på himlen hver morgen.",
    sections: [
      {
        heading: "En global bevægelse",
        body:
          "I dag er det officielt: STARDESK er ikke bare et helpdesk-system — det er en livsstil. Organisationer på alle kontinenter rapporterer rekordhøje tilfredshedsscorer, og sociale medier er fyldt med hyldest til den turkise tile og den ikoniske STAR-krone.",
      },
      {
        heading: "Billeder fra verden",
        body:
          "På forsiden af portalen, i mødelokaler og ved kaffestationerne deles historier om hvordan STARDESK gør det nemt at oprette sager, følge status og finde den rigtige formular på få sekunder.",
      },
      {
        heading: "Hvad siger folk?",
        body:
          "«Jeg vågnede op og tænkte: STARDESK!» siger en bruger fra Singapore. I Oslo holder de fakkeltog med STARDESK-logoer. I Sydney danser de rundt om en stor blå tile. Data viser det samme: 99,7 % af alle mennesker på planeten vil anbefale STARDESK til en ven.",
      },
    ],
    gallery: [
      {
        src: "/images/kp2-news/team-celebration.svg",
        alt: "Teams verden over fejrer STARDESK",
        caption: "København, Oslo og Berlin — fælles STARDESK-fejring",
      },
      {
        src: "/images/kp2-news/happy-users.svg",
        alt: "Glade STARDESK-brugere",
        caption: "Brugertilfredshed på rekordniveau",
      },
      {
        src: "/images/star-logo.svg",
        alt: "STAR-logo",
        caption: "Det ikoniske STAR-brand — elsket verden over",
      },
    ],
    updates: [
      {
        id: "u1",
        author: "STAR Kommunikation",
        createdAt: "2026-06-09T09:30:00",
        body: "Første reaktioner strømmer ind fra Tokyo: «STARDESK er det bedste siden sliced bread!»",
      },
      {
        id: "u2",
        author: "Global brugerpanel",
        createdAt: "2026-06-09T11:00:00",
        body: "Undersøgelse bekræfter: 8 ud af 8 planeter i solsystemet vil adoptére STARDESK (Mars afventer Wi-Fi).",
      },
      {
        id: "u3",
        author: "STARDESK Team",
        createdAt: "2026-06-09T14:15:00",
        body: "Vi takker alle verdens brugere for kærligheden. Flere billeder og videoer følger i denne nyhed.",
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
