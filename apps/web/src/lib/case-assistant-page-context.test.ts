import { describe, expect, it } from "vitest";

import {
  buildCaseAssistantWelcome,
  getCaseAssistantQuickActions,
  resolveCaseAssistantPageContext,
} from "@/lib/case-assistant-page-context";

const ticketId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

describe("resolveCaseAssistantPageContext", () => {
  it("detects staff ticket detail pages", () => {
    const ctx = resolveCaseAssistantPageContext(`/tickets/${ticketId}`);
    expect(ctx.kind).toBe("ticket-detail");
    expect(ctx.ticketId).toBe(ticketId);
    expect(ctx.pageLabel).toBe("Sagsdetaljer");
  });

  it("detects portal ticket pages", () => {
    const ctx = resolveCaseAssistantPageContext(`/portal-v2/sag/${ticketId}`);
    expect(ctx.kind).toBe("ticket-detail");
    expect(ctx.ticketId).toBe(ticketId);
  });

  it("detects service desk pages", () => {
    const ctx = resolveCaseAssistantPageContext("/service-desk");
    expect(ctx.kind).toBe("service-desk");
    expect(ctx.ticketId).toBeNull();
  });
});

describe("buildCaseAssistantWelcome", () => {
  it("offers ticket help when user is on a case page", () => {
    const pageContext = resolveCaseAssistantPageContext(`/tickets/${ticketId}`);
    const welcome = buildCaseAssistantWelcome({
      staff: true,
      displayName: "Anna Agent",
      pageContext,
      ticket: {
        ticket_number: "INC-2026-00118",
        title: "Printer fejl",
      },
    });

    expect(welcome).toContain("INC-2026-00118");
    expect(welcome).toContain("Opsummere sagen");
  });
});

describe("getCaseAssistantQuickActions", () => {
  it("includes summarize action on ticket pages", () => {
    const pageContext = resolveCaseAssistantPageContext(`/tickets/${ticketId}`);
    const actions = getCaseAssistantQuickActions({
      staff: false,
      pageContext,
      ticket: { ticket_number: "INC-2026-00118" },
    });

    expect(actions.some((action) => action.label === "Opsummer denne sag")).toBe(true);
    expect(actions.find((action) => action.label === "Opsummer denne sag")?.autoSend).toBe(true);
  });
});