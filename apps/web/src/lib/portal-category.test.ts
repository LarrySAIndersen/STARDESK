import { describe, expect, it } from "vitest";

import {
  categorySlugFromName,
  filterArticlesForCategory,
  filterOpenDeptTickets,
  findCategoryBySlug,
  getPortalServicesForCategory,
  resolvePortalCategory,
} from "./portal-category";
import type { Category } from "@/types/category";
import type { KnowledgeArticle } from "@/types/knowledge-article";
import type { Ticket } from "@/types/ticket";

describe("categorySlugFromName", () => {
  it("normalises Danish names to URL slugs", () => {
    expect(categorySlugFromName("HR & personale")).toBe("hr-og-personale");
    expect(categorySlugFromName("  Netværk  ")).toBe("netv-rk");
  });
});

describe("findCategoryBySlug", () => {
  const categories: Category[] = [
    {
      id: "c1",
      name: "IT support",
      name_da: "IT-support",
      subcategories: [],
    },
  ];

  it("finds category by generated slug", () => {
    expect(findCategoryBySlug(categories, "it-support")?.id).toBe("c1");
    expect(findCategoryBySlug(categories, "missing")).toBeUndefined();
  });
});

describe("resolvePortalCategory", () => {
  it("merges tile and API category data", () => {
    const resolved = resolvePortalCategory("it-support", [
      { id: "c1", name: "IT", name_da: "IT Support", subcategories: [] },
    ]);
    expect(resolved?.nameDa).toBe("IT Support");
    expect(resolved?.icon).toBe("monitor");
    expect(resolvePortalCategory("unknown-slug", [])).toBeNull();
  });
});

describe("filterOpenDeptTickets", () => {
  const tickets: Ticket[] = [
    {
      id: "1",
      ticket_number: "INC-1",
      title: "Open IT",
      status: "new",
      priority: "medium",
      ticket_type: "incident",
      is_major: false,
      sub_causes: [],
      created_at: "2026-06-10T10:00:00.000Z",
      category_name_da: "IT-support",
    },
    {
      id: "2",
      ticket_number: "INC-2",
      title: "Major",
      status: "new",
      priority: "critical",
      ticket_type: "incident",
      is_major: true,
      sub_causes: [],
      created_at: "2026-06-10T10:00:00.000Z",
      category_name_da: "IT-support",
    },
  ];

  it("returns open non-major tickets in category", () => {
    expect(filterOpenDeptTickets(tickets, "IT-support")).toHaveLength(1);
  });
});

describe("filterArticlesForCategory", () => {
  const articles: KnowledgeArticle[] = [
    {
      id: "a1",
      ticket_number: "KB-1",
      title: "VPN guide",
      description: "",
      summary: "IT-support VPN opsætning",
      symptoms: "",
      solution: "",
      related_topics: "",
      knowledge_status: "published",
      knowledge_status_label_da: "Publiceret",
      knowledge_visibility: "external",
      knowledge_visibility_label_da: "Ekstern",
      tags: ["vpn"],
      created_at: "2026-06-01T00:00:00.000Z",
      updated_at: "2026-06-02T00:00:00.000Z",
    },
    {
      id: "a2",
      ticket_number: "KB-2",
      title: "HR onboarding",
      description: "",
      summary: "Personale onboarding",
      symptoms: "",
      solution: "",
      related_topics: "",
      knowledge_status: "published",
      knowledge_status_label_da: "Publiceret",
      knowledge_visibility: "external",
      knowledge_visibility_label_da: "Ekstern",
      tags: [],
      created_at: "2026-06-01T00:00:00.000Z",
    },
  ];

  it("scores and ranks articles for category", () => {
    const result = filterArticlesForCategory(articles, "IT-support", 5);
    expect(result[0]?.id).toBe("a1");
  });
});

describe("getPortalServicesForCategory", () => {
  it("returns curated services for known slugs", () => {
    const services = getPortalServicesForCategory("it-support");
    expect(services.length).toBeGreaterThan(3);
    expect(services[0]?.id).toMatch(/^it-support-/);
  });

  it("falls back to generic create ticket item", () => {
    expect(getPortalServicesForCategory("other")[0]?.title).toBe("Opret sag");
  });
});
