import { describe, expect, it } from "vitest";

import {
  buildCaseAssistantWelcome,
  buildCaseAssistantWelcomeMessages,
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

  it("detects reports pages", () => {
    const ctx = resolveCaseAssistantPageContext("/reports");
    expect(ctx.kind).toBe("reports");
    expect(ctx.pageLabel).toBe("Rapporter");
    expect(ctx.ticketId).toBeNull();
  });

  it("detects analytics pages", () => {
    const ctx = resolveCaseAssistantPageContext("/reports/analytics");
    expect(ctx.kind).toBe("analytics");
    expect(ctx.pageLabel).toBe("Avanceret sagsanalyse");
  });

  it("detects kanban pages", () => {
    const ctx = resolveCaseAssistantPageContext("/kanban/board-1");
    expect(ctx.kind).toBe("kanban");
  });

  it("detects dashboard and backlog pages", () => {
    expect(resolveCaseAssistantPageContext("/").kind).toBe("dashboard");
    expect(resolveCaseAssistantPageContext("/").pageLabel).toBe("Hjem");
    expect(resolveCaseAssistantPageContext("/backlog").kind).toBe("backlog");
    expect(resolveCaseAssistantPageContext("/min-side").pageLabel).toBe("Min side");
  });

  it("detects portal and knowledge pages", () => {
    expect(resolveCaseAssistantPageContext("/portal").kind).toBe("portal");
    expect(resolveCaseAssistantPageContext("/knowledge").kind).toBe("knowledge");
    expect(resolveCaseAssistantPageContext("/tickets/new").kind).toBe("create-ticket");
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
    expect(welcome.toLowerCase()).toContain("opsummering");
  });

  it("splits general and page-specific welcome messages", () => {
    const pageContext = resolveCaseAssistantPageContext("/");
    const { general, pageSpecific } = buildCaseAssistantWelcomeMessages({
      staff: true,
      displayName: "Anna Agent",
      pageContext,
    });

    expect(general).toContain("Hvad kan jeg hjælpe med");
    expect(pageSpecific).toContain("Hjem");
    expect(pageSpecific.endsWith("?")).toBe(true);
  });

  it("offers reports help on the reports page", () => {
    const pageContext = resolveCaseAssistantPageContext("/reports");
    const welcome = buildCaseAssistantWelcome({
      staff: true,
      displayName: "Anna Agent",
      pageContext,
    });

    expect(welcome).toContain("Rapporter");
    expect(welcome.toLowerCase()).toContain("kpi");
  });
});

describe("getCaseAssistantQuickActions", () => {
  it("starts with a general help action", () => {
    const pageContext = resolveCaseAssistantPageContext("/reports");
    const actions = getCaseAssistantQuickActions({
      staff: true,
      pageContext,
    });

    expect(actions[0]?.label).toBe("Generel hjælp");
  });

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

  it("includes KPI actions on reports pages", () => {
    const pageContext = resolveCaseAssistantPageContext("/reports");
    const actions = getCaseAssistantQuickActions({
      staff: true,
      pageContext,
    });

    expect(actions.some((action) => action.label === "Forklar KPI'er")).toBe(true);
  });

  it("includes backlog help on backlog pages", () => {
    const pageContext = resolveCaseAssistantPageContext("/backlog");
    const actions = getCaseAssistantQuickActions({
      staff: true,
      pageContext,
    });

    expect(actions.some((action) => action.label === "Prioritering")).toBe(true);
  });
});

describe("buildCaseAssistantWelcome portal", () => {
  it("welcomes portal users on min-side", () => {
    const pageContext = resolveCaseAssistantPageContext("/min-side");
    const welcome = buildCaseAssistantWelcome({
      staff: false,
      displayName: "Borger",
      pageContext,
    });

    expect(welcome).toContain("Borger");
    expect(welcome.toLowerCase()).toMatch(/sag|hjælp/);
  });
});