import type { Category } from "@/types/category";
import type { KnowledgeArticle } from "@/types/knowledge-article";
import type { Ticket } from "@/types/ticket";

/** URL slug from Danish category name. */
export function categorySlugFromName(nameDa: string): string {
  return nameDa
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "og")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function findCategoryBySlug(
  categories: Category[],
  slug: string,
): Category | undefined {
  return categories.find((c) => categorySlugFromName(c.name_da) === slug);
}

/** Curated portal tiles when API categories are sparse. */
export const PORTAL_V2_CATEGORY_TILES = [
  {
    slug: "it-support",
    nameDa: "IT-support",
    description: "Computer, software, adgang og digitale tjenester.",
    icon: "monitor",
  },
  {
    slug: "hr-personale",
    nameDa: "HR & personale",
    description: "Onboarding, adgang, politikker og medarbejderforhold.",
    icon: "users",
  },
  {
    slug: "faciliteter",
    nameDa: "Faciliteter",
    description: "Lokaler, udstyr, print og fysiske faciliteter.",
    icon: "building",
  },
] as const;

export type PortalCategoryTile = (typeof PORTAL_V2_CATEGORY_TILES)[number];

export function findPortalCategoryTile(slug: string): PortalCategoryTile | undefined {
  return PORTAL_V2_CATEGORY_TILES.find((t) => t.slug === slug);
}

export function resolvePortalCategory(
  slug: string,
  apiCategories: Category[],
): {
  nameDa: string;
  description: string;
  icon: string;
  apiCategory: Category | null;
} | null {
  const tile = findPortalCategoryTile(slug);
  const apiCategory = findCategoryBySlug(apiCategories, slug);
  if (!tile && !apiCategory) {
    return null;
  }
  return {
    nameDa: apiCategory?.name_da ?? tile!.nameDa,
    description: tile?.description ?? `Sager og viden inden for ${apiCategory?.name_da ?? slug}.`,
    icon: tile?.icon ?? "folder",
    apiCategory: apiCategory ?? null,
  };
}

const OPEN_STATUSES = new Set(["new", "assigned", "in_progress", "on_hold", "pending"]);

export function filterOpenDeptTickets(
  tickets: Ticket[],
  categoryNameDa: string,
): Ticket[] {
  return tickets.filter(
    (t) =>
      !t.is_major &&
      OPEN_STATUSES.has(t.status) &&
      (t.category_name_da?.toLowerCase() === categoryNameDa.toLowerCase() ||
        categoryNameDa.toLowerCase().includes((t.category_name_da ?? "").toLowerCase()) ||
        (t.category_name_da ?? "").toLowerCase().includes(categoryNameDa.toLowerCase())),
  );
}

export function filterArticlesForCategory(
  articles: KnowledgeArticle[],
  categoryNameDa: string,
  limit = 7,
): KnowledgeArticle[] {
  const needle = categoryNameDa.toLowerCase();
  const scored = articles
    .map((article) => {
      const hay = `${article.title} ${article.summary} ${article.tags.join(" ")}`.toLowerCase();
      let score = 0;
      if (hay.includes(needle)) score += 3;
      for (const word of needle.split(/\s+/)) {
        if (word.length > 2 && hay.includes(word)) score += 1;
      }
      return { article, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => {
      const byScore = b.score - a.score;
      if (byScore !== 0) return byScore;
      return (
        b.article.updated_at?.localeCompare(a.article.updated_at ?? "") ?? 0
      );
    });

  const picked = scored.slice(0, limit).map((x) => x.article);
  if (picked.length >= 5) {
    return picked;
  }
  return articles.slice(0, limit);
}

export interface PortalServiceItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  /** TODO: wire from service catalog API when available */
  estimatedTime?: string;
  href: string;
}

/** Placeholder catalog until service-request API exists. */
export function getPortalServicesForCategory(slug: string): PortalServiceItem[] {
  const base = `/tickets/new`;
  const bySlug: Record<string, Omit<PortalServiceItem, "id">[]> = {
    "it-support": [
      {
        title: "Nyt udstyr",
        description: "Bestil computer, skærm eller tilbehør.",
        icon: "laptop",
        estimatedTime: "2–3 dage",
        href: base,
      },
      {
        title: "Adgangskode nulstillet",
        description: "Få hjælp til login og MFA.",
        icon: "key",
        estimatedTime: "Samme dag",
        href: base,
      },
      {
        title: "Softwareinstallation",
        description: "Anmod om godkendt software på din PC.",
        icon: "download",
        estimatedTime: "1–2 dage",
        href: base,
      },
      {
        title: "VPN-problem",
        description: "Fejlsøgning af fjernadgang.",
        icon: "wifi",
        estimatedTime: "Samme dag",
        href: base,
      },
      {
        title: "E-mail / Outlook",
        description: "Synk, delte postkasser og signaturer.",
        icon: "mail",
        estimatedTime: "1 dag",
        href: base,
      },
      {
        title: "Andet IT-spørgsmål",
        description: "Beskriv dit behov — vi finder rette team.",
        icon: "help-circle",
        href: base,
      },
    ],
    "hr-personale": [
      {
        title: "Onboarding",
        description: "Adgang og udstyr til ny medarbejder.",
        icon: "user-plus",
        estimatedTime: "3–5 dage",
        href: base,
      },
      {
        title: "Orlov / fravær",
        description: "Registrering og spørgsmål om fravær.",
        icon: "calendar",
        estimatedTime: "2 dage",
        href: base,
      },
      {
        title: "Løn og ferie",
        description: "Spørgsmål til løn, ferie og timer.",
        icon: "wallet",
        href: base,
      },
      {
        title: "Politikker",
        description: "Find retningslinjer og dokumenter.",
        icon: "file-text",
        href: base,
      },
    ],
    faciliteter: [
      {
        title: "Book lokale",
        description: "Mødelokaler og fællesarealer.",
        icon: "door-open",
        estimatedTime: "Samme dag",
        href: base,
      },
      {
        title: "Print / scanner",
        description: "Fejl på printer eller kopi.",
        icon: "printer",
        estimatedTime: "1 dag",
        href: base,
      },
      {
        title: "Kontorartikler",
        description: "Bestil forbrugsvarer og udstyr.",
        icon: "package",
        href: base,
      },
      {
        title: "Adgangskort",
        description: "Nyt kort eller rettigheder.",
        icon: "badge",
        estimatedTime: "2 dage",
        href: base,
      },
    ],
  };

  const items = bySlug[slug] ?? [
    {
      title: "Opret sag",
      description: "Beskriv dit behov — vi videresender til rette team.",
      icon: "plus-circle",
      href: base,
    },
  ];

  return items.map((item, index) => ({
    id: `${slug}-${index}`,
    ...item,
  }));
}
