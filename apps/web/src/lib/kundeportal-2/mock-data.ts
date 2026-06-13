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
    description: "Oversigt over dine aktive sager",
    href: `${KP2_BASE}/mine-sager`,
    icon: "list-checks",
    group: "sager",
    featured: true,
  },
  {
    id: "mine-sager-udvidet",
    title: "Mine sager (udvidet)",
    description: "Filtrer og sorter alle dine sager",
    href: `${KP2_BASE}/mine-sager/udvidet`,
    icon: "layout-list",
    group: "sager",
    featured: true,
  },
  {
    id: "sager-aar",
    title: "Sager - År",
    description: "Årlig statistik for 2. linje",
    href: `${KP2_BASE}/statistik?vis=aar`,
    icon: "bar-chart",
    group: "sager",
    featured: true,
  },
  {
    id: "sager-maaned",
    title: "Sager - Måned",
    description: "Månedlig statistik for 2. linje",
    href: `${KP2_BASE}/statistik?vis=maaned`,
    icon: "bar-chart-2",
    group: "sager",
    featured: true,
  },
  {
    id: "fejl-produktion",
    title: "Fejl Produktion",
    description: "Meld fejl i produktionsmiljø",
    href: `${KP2_BASE}/service-requests/fejl-produktion`,
    icon: "alert-circle",
    group: "opret",
    featured: true,
  },
  {
    id: "fejl-test",
    title: "Fejl Testmiljø",
    description: "Meld fejl i testmiljø",
    href: `${KP2_BASE}/service-requests/fejl-testmiljo`,
    icon: "bug",
    group: "opret",
    featured: true,
  },
  {
    id: "spoergsmaal",
    title: "Spørgsmål",
    description: "Stil et generelt spørgsmål",
    href: `${KP2_BASE}/service-requests/sporgsmaal`,
    icon: "help-circle",
    group: "opret",
    featured: true,
  },
  {
    id: "aendring",
    title: "Ændring",
    description: "Anmod om en ændring",
    href: `${KP2_BASE}/service-requests/aendring`,
    icon: "git-branch",
    group: "opret",
    featured: true,
  },
  {
    id: "katalog",
    title: "Service Requests & Changes",
    description: "Fuldt katalog over alle formularer",
    href: `${KP2_BASE}/service-requests`,
    icon: "folder-open",
    group: "katalog",
    featured: true,
  },
];

export const KP2_SERVICE_MESSAGES: Kp2ServiceMessage[] = [
  {
    id: "omfattende-serviceafbrydelse",
    bannerLabel: "Driftsmeddelelse",
    tone: "alert",
    title: "Udfordringer med adviseringer",
    summary:
      "Vi oplever udfordringer med at adviseringer om sager ikke altid sendes korrekt. Svartider kan være længere end normalt.",
    status: "behandler",
    type: "Incident",
    categorization: "Middleware - Adviseringer",
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
