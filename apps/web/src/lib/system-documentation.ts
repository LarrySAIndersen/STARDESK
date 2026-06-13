export const SYSTEM_DOCS_GITHUB_BASE =
  "https://github.com/LarrySAIndersen/STARDESK/blob/staging/docs";

export type SystemDocumentationEntry = {
  id: string;
  title: string;
  description: string;
  filename: string;
};

export const SYSTEM_DOCUMENTATION_ENTRIES: SystemDocumentationEntry[] = [
  {
    id: "documentation",
    title: "Dokumentationsoversigt",
    description: "Hurtig fejlsøgning og indeks over alle dokumenter.",
    filename: "DOCUMENTATION.md",
  },
  {
    id: "data-model",
    title: "Datamodel",
    description: "Tabeller, felter, enum-værdier og relationer.",
    filename: "data-model.md",
  },
  {
    id: "design-decisions",
    title: "Designbeslutninger",
    description: "Arkitektur- og produktvalg.",
    filename: "design-decisions.md",
  },
  {
    id: "api-reference",
    title: "API-reference",
    description: "REST-endpoints og vigtige payloads.",
    filename: "api-reference.md",
  },
  {
    id: "demo-users",
    title: "Demo-brugere og adgang",
    description: "Testbrugere, grupper og adgangsregler.",
    filename: "demo-users-and-access.md",
  },
  {
    id: "environments",
    title: "Miljøer",
    description: "Test, produktion og prod-klon (Neon + Vercel).",
    filename: "environments.md",
  },
  {
    id: "deploy",
    title: "Deploy",
    description: "Vercel (web + API) og Neon-migrationer.",
    filename: "deploy.md",
  },
  {
    id: "frontend-structure",
    title: "Frontend-struktur",
    description: "Next.js-ruter og komponenter.",
    filename: "frontend-structure.md",
  },
  {
    id: "deliverable-gate",
    title: "Deliverable gate",
    description: "Hello-world gate før leverance.",
    filename: "deliverable-gate.md",
  },
];

export function systemDocumentationHref(filename: string): string {
  return `${SYSTEM_DOCS_GITHUB_BASE}/${filename}`;
}
