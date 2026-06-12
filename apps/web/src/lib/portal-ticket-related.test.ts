import { describe, expect, it } from "vitest";

import { relatedArticlesForTicket } from "./portal-ticket-related";
import type { KnowledgeArticle } from "@/types/knowledge-article";
import type { TicketDetail } from "@/types/ticket";

function makeArticle(overrides: Partial<KnowledgeArticle> = {}): KnowledgeArticle {
  return {
    id: "a1",
    ticket_number: "KB-1",
    title: "VPN guide",
    description: "",
    summary: "Netværk VPN opsætning",
    symptoms: "",
    solution: "",
    related_topics: "",
    knowledge_status: "published",
    knowledge_status_label_da: "Publiceret",
    knowledge_visibility: "external",
    knowledge_visibility_label_da: "Ekstern",
    tags: ["vpn"],
    created_at: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeTicketDetail(overrides: Partial<TicketDetail> = {}): TicketDetail {
  return {
    id: "t1",
    ticket_number: "INC-1",
    title: "VPN problem",
    description: "Kan ikke forbinde",
    status: "new",
    priority: "medium",
    ticket_type: "incident",
    is_major: false,
    sub_causes: [],
    created_at: "2026-06-10T10:00:00.000Z",
    category_id: null,
    subcategory_id: null,
    assigned_team_id: null,
    assigned_team_name: null,
    assigned_user_id: null,
    assigned_user_name: null,
    response_due_at: null,
    resolution_due_at: null,
    escalation_level: 0,
    gdpr_consent: false,
    gdpr_consent_at: null,
    subject_cpr: null,
    attachments: [],
    comments: [],
    category_name_da: "Netværk",
    subcategory_name_da: "VPN",
    tags: ["remote"],
    ...overrides,
  };
}

describe("relatedArticlesForTicket", () => {
  const articles = [
    makeArticle({ id: "match", title: "Netværk remote access" }),
    makeArticle({ id: "other", title: "HR onboarding", summary: "Personale", tags: [] }),
  ];

  it("scores articles by category, subcategory and tags", () => {
    const related = relatedArticlesForTicket(makeTicketDetail(), articles, 4);
    expect(related[0]?.id).toBe("match");
  });

  it("falls back to first articles when ticket has no needles", () => {
    const related = relatedArticlesForTicket(
      makeTicketDetail({ category_name_da: undefined, subcategory_name_da: undefined, tags: [] }),
      articles,
      1,
    );
    expect(related).toHaveLength(1);
    expect(related[0]?.id).toBe("match");
  });
});
