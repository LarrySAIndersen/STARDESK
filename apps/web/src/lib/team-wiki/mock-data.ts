export type WikiPage = {
  id: string;
  title: string;
  parentId: string | null;
  updatedAt: string;
  updatedBy: string;
  labels: string[];
  content: string;
};

export type WikiSpace = {
  id: string;
  key: string;
  name: string;
  description: string;
  homePageId: string;
};

export const WIKI_SPACES: WikiSpace[] = [
  {
    id: "space-it",
    key: "ITDRIFT",
    name: "STAR IT-driftswiki",
    description: "Intern viden om drift, onboarding og fejlretning.",
    homePageId: "page-home",
  },
  {
    id: "space-sd",
    key: "SD",
    name: "Service Desk playbooks",
    description: "Standardprocedurer for 1. linje og eskalering.",
    homePageId: "page-sd-home",
  },
];

export const WIKI_PAGES: WikiPage[] = [
  {
    id: "page-home",
    title: "Velkommen til IT-driftswiki",
    parentId: null,
    updatedAt: "2026-06-10T09:15:00Z",
    updatedBy: "Anna Jensen",
    labels: ["intro", "onboarding"],
    content: `# Velkommen

Dette er **teamwiki** i STARDESK — til intern dokumentation, playbooks og runbooks.

## Hvad du finder her

- Driftsprocedurer og fejlsøgning
- Onboarding af nye medarbejdere
- Ændrings- og release-noter

## Kom i gang

Vælg en side i træet til venstre, eller brug søgefeltet øverst. Prototypen bruger statisk demo-indhold — senere kan den kobles til vidensartikler eller et rigtigt wiki-API.

> Tip: Brug mærkater som \`vpn\` og \`onboarding\` til at finde relateret indhold.`,
  },
  {
    id: "page-onboarding",
    title: "Onboarding — nye agenter",
    parentId: "page-home",
    updatedAt: "2026-06-08T14:30:00Z",
    updatedBy: "Jan Nielsen",
    labels: ["onboarding", "agent"],
    content: `# Onboarding — nye agenter

Checkliste for nye Service Desk-agenter i STARDESK.

## Dag 1

1. Opret AD-konto og tildel gruppe \`STAR-SD-Agents\`
2. Gennemfør intro til STARDESK (Hjem → Sitemap)
3. Læs SLA-politik under Administration

## Dag 2–5

- Skyg en erfaren agent i minimum 4 timer
- Opret test-sager i testmiljøet
- Gennemgå vidensartikler under **Vidensartikler**

## Kontakt

Spørgsmål? Skriv til \`it-sd@star.dk\`.`,
  },
  {
    id: "page-vpn",
    title: "VPN — fejlsøgning",
    parentId: "page-onboarding",
    updatedAt: "2026-06-11T11:00:00Z",
    updatedBy: "Maria Hansen",
    labels: ["vpn", "netværk"],
    content: `# VPN — fejlsøgning

Standardtrin når brugeren ikke kan forbinde til STAR VPN.

## Symptomer

- Klienten hænger på "Forbinder…"
- Fejl 809 eller certifikat-advarsel

## Løsning

1. Bekræft at brugeren er i gruppen \`STAR-VPN-Users\`
2. Genudsted certifikat via selvbetjening (max 1× per 24 timer)
3. Bed brugeren genstarte VPN-klienten
4. Eskalér til 2. linje hvis fejl fortsætter efter certifikat-fornyelse

## Relaterede sager

Link til vidensartikel KB-2024-00012 i STARDESK.`,
  },
  {
    id: "page-changes",
    title: "Ændringsvinduer",
    parentId: "page-home",
    updatedAt: "2026-06-05T08:00:00Z",
    updatedBy: "Lars Andersen",
    labels: ["change", "drift"],
    content: `# Ændringsvinduer

Planlagte vedligeholdelsesvinduer for STAR-miljøer.

## Testmiljø

- Onsdage 18:00–20:00 — database-patches
- Ingen prod-påvirkning

## Produktion

- Søndage 02:00–06:00 — månedlige releases
- Kræver godkendt change request (CR) i STARDESK

## Kommunikation

Alle vinduer annonceres på status.stardesk.dk og i Selvbetjeningsportalen.`,
  },
  {
    id: "page-sd-home",
    title: "Service Desk — oversigt",
    parentId: null,
    updatedAt: "2026-06-09T16:45:00Z",
    updatedBy: "Anna Jensen",
    labels: ["playbook"],
    content: `# Service Desk playbooks

Samling af standardprocedurer for 1. linje.

## Struktur

Hver playbook beskriver: **symptom → triage → løsning → eskalering**.

Se undermapper for password reset, printer og mail.`,
  },
  {
    id: "page-password",
    title: "Password reset",
    parentId: "page-sd-home",
    updatedAt: "2026-06-07T10:20:00Z",
    updatedBy: "Maria Hansen",
    labels: ["ad", "password"],
    content: `# Password reset

## Før du starter

Bekræft identitet via MitID eller kendt sikkerhedsspørgsmål.

## Trin

1. Søg bruger i STARDESK → Brugere
2. Vælg **Nulstil adgangskode**
3. Informér bruger om midlertidig kode (SMS eller sikker kanal)
4. Bed bruger skifte kode ved første login

## Eskalering

Ved mistanke om kompromittering: opret P1-sag og kontakt sikkerhed.`,
  },
];

export function pagesForSpace(space: WikiSpace): WikiPage[] {
  const ids = new Set<string>([space.homePageId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const page of WIKI_PAGES) {
      if (page.parentId && ids.has(page.parentId) && !ids.has(page.id)) {
        ids.add(page.id);
        changed = true;
      }
    }
  }
  return WIKI_PAGES.filter((page) => ids.has(page.id));
}

export function getPageById(pageId: string): WikiPage | undefined {
  return WIKI_PAGES.find((page) => page.id === pageId);
}

export function getSpaceForPage(pageId: string): WikiSpace | undefined {
  for (const space of WIKI_SPACES) {
    const pages = pagesForSpace(space);
    if (pages.some((page) => page.id === pageId)) {
      return space;
    }
  }
  return undefined;
}

export function buildPageTree(
  pages: WikiPage[],
  parentId: string | null = null,
): Array<{ page: WikiPage; children: ReturnType<typeof buildPageTree> }> {
  return pages
    .filter((page) => page.parentId === parentId)
    .sort((a, b) => a.title.localeCompare(b.title, "da"))
    .map((page) => ({
      page,
      children: buildPageTree(pages, page.id),
    }));
}

export function pageBreadcrumb(pageId: string, pages: WikiPage[]): WikiPage[] {
  const byId = new Map(pages.map((page) => [page.id, page]));
  const trail: WikiPage[] = [];
  let current = byId.get(pageId);
  while (current) {
    trail.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return trail;
}

export function extractHeadings(
  markdown: string,
): Array<{ level: number; text: string; id: string }> {
  const headings: Array<{ level: number; text: string; id: string }> = [];
  for (const line of markdown.split("\n")) {
    const match = /^(#{1,3})\s+(.+)$/.exec(line.trim());
    if (!match) continue;
    const text = match[2].replace(/\*\*/g, "").trim();
    const id = text
      .toLowerCase()
      .replace(/[^a-z0-9æøå]+/gi, "-")
      .replace(/^-|-$/g, "");
    headings.push({ level: match[1].length, text, id });
  }
  return headings;
}
