import type { Ticket } from "@/types/ticket";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CaseAssistantPageKind =
  | "ticket-detail"
  | "ticket-list"
  | "service-desk"
  | "dashboard"
  | "knowledge"
  | "create-ticket"
  | "other";

export type CaseAssistantPageContext = {
  kind: CaseAssistantPageKind;
  pagePath: string;
  pageLabel: string;
  ticketId: string | null;
  contextKey: string;
};

export type CaseAssistantQuickAction = {
  label: string;
  message: string;
  autoSend?: boolean;
};

const PAGE_LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/service-desk": "Service Desk",
  "/kanban": "Kanban",
  "/backlog": "Backlog",
  "/tickets": "Alle sager",
  "/tickets/new": "Ny sag",
  "/tickets/major": "Store sager",
  "/knowledge": "Vidensartikler",
  "/portal": "Selvbetjening",
  "/min-side": "Min side",
};

function extractTicketId(pathname: string): string | null {
  const patterns = [
    /^\/tickets\/([^/]+)/,
    /^\/classic\/tickets\/([^/]+)/,
    /^\/portal-v2\/sag\/([^/]+)/,
    /^\/portal\/sag\/([^/]+)/,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(pathname);
    const candidate = match?.[1];
    if (!candidate || candidate === "new" || candidate === "major") {
      continue;
    }
    if (UUID_RE.test(candidate)) {
      return candidate;
    }
  }

  return null;
}

function resolvePageKind(pathname: string, ticketId: string | null): CaseAssistantPageKind {
  if (ticketId) {
    return "ticket-detail";
  }
  if (pathname === "/tickets/new") {
    return "create-ticket";
  }
  if (pathname === "/tickets" || pathname === "/tickets/major") {
    return "ticket-list";
  }
  if (pathname === "/service-desk" || pathname.startsWith("/service-desk/")) {
    return "service-desk";
  }
  if (pathname === "/" || pathname.startsWith("/min-side")) {
    return "dashboard";
  }
  if (pathname.startsWith("/knowledge") || pathname.startsWith("/portal/knowledge")) {
    return "knowledge";
  }
  return "other";
}

function resolvePageLabel(pathname: string, kind: CaseAssistantPageKind): string {
  if (kind === "ticket-detail") {
    return pathname.endsWith("/overview") ? "Tilknyttede sager" : "Sagsdetaljer";
  }
  if (PAGE_LABELS[pathname]) {
    return PAGE_LABELS[pathname];
  }
  const segment = pathname.split("/").filter(Boolean)[0];
  if (!segment) {
    return "STARdesk";
  }
  return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ");
}

export function resolveCaseAssistantPageContext(pathname: string): CaseAssistantPageContext {
  const pagePath = pathname || "/";
  const ticketId = extractTicketId(pagePath);
  const kind = resolvePageKind(pagePath, ticketId);
  const pageLabel = resolvePageLabel(pagePath, kind);
  const contextKey = ticketId ? `ticket:${ticketId}` : `${kind}:${pagePath}`;

  return {
    kind,
    pagePath,
    pageLabel,
    ticketId,
    contextKey,
  };
}

export function buildCaseAssistantWelcome(options: {
  staff: boolean;
  displayName?: string | null;
  pageContext: CaseAssistantPageContext;
  ticket?: Pick<Ticket, "ticket_number" | "title"> | null;
}): string {
  const { staff, displayName, pageContext, ticket } = options;
  const namePart = displayName ? ` ${displayName.split(" ")[0]}` : "";

  if (pageContext.kind === "ticket-detail") {
    const ticketLabel = ticket
      ? `**${ticket.ticket_number}** — ${ticket.title}`
      : "den sag, du kigger på";

    if (staff) {
      return [
        `Hej${namePart}! Du er på sagsdetaljer for ${ticketLabel}.`,
        "",
        "Vil du have hjælp? Jeg kan fx:",
        "• Opsummere sagen",
        "• Forklare status og SLA",
        "• Foreslå næste skridt",
        "",
        "Tryk på et forslag nedenfor, eller skriv frit.",
      ].join("\n");
    }

    return [
      `Hej${namePart}! Du kigger på ${ticketLabel}.`,
      "",
      "Skal jeg hjælpe? Jeg kan fx opsummere sagen eller forklare status.",
      "Tryk på et forslag nedenfor, eller skriv dit spørgsmål.",
    ].join("\n");
  }

  if (pageContext.kind === "ticket-list") {
    return staff
      ? `Hej${namePart}! Du er i **${pageContext.pageLabel}**. Spørg fx om \`mine sager\`, et sagsnummer, eller brug mikrofonen.`
      : `Hej${namePart}! Her kan du se sager. Skriv \`mine sager\` eller et sagsnummer for hjælp.`;
  }

  if (pageContext.kind === "create-ticket") {
    return `Hej${namePart}! Du opretter en ny sag. Skriv fx \`opret Titel - Beskrivelse\`, eller spørg om kategorier.`;
  }

  if (pageContext.kind === "service-desk") {
    return staff
      ? `Hej${namePart}! Du er på **Service Desk**. Jeg kan hjælpe med sagsopslag, status og korte kommandoer.`
      : `Hej${namePart}! Spørg om dine sager eller skriv et sagsnummer.`;
  }

  if (pageContext.kind === "knowledge") {
    return `Hej${namePart}! Du er i **vidensbasen**. Spørg fx om VPN, MitID eller andre emner.`;
  }

  if (staff) {
    return [
      `Hej${namePart}! Jeg er Help-a-bot. Du er på **${pageContext.pageLabel}**.`,
      "",
      "Korte kommandoer:",
      "• `INC-2026-00118` — find sag",
      "• `luk INC-…` — luk sag",
      "• `mine sager` — dine sager",
      "• `opret Titel - Beskrivelse` — ny sag",
    ].join("\n");
  }

  return `Hej${namePart}! Skriv kort: \`mine sager\`, sagsnummer, eller \`opret Titel - Beskrivelse\`. Mikrofonen virker også.`;
}

export function getCaseAssistantQuickActions(options: {
  staff: boolean;
  pageContext: CaseAssistantPageContext;
  ticket?: Pick<Ticket, "ticket_number"> | null;
}): CaseAssistantQuickAction[] {
  const { staff, pageContext, ticket } = options;

  if (pageContext.kind === "ticket-detail") {
    const actions: CaseAssistantQuickAction[] = [
      { label: "Opsummer denne sag", message: "Opsummer denne sag", autoSend: true },
      { label: "Forklar status", message: "Forklar status på denne sag", autoSend: true },
    ];
    if (staff) {
      actions.push({
        label: "Næste skridt",
        message: "Hvad er de anbefalede næste skridt på denne sag?",
        autoSend: true,
      });
      if (ticket?.ticket_number) {
        actions.push({
          label: ticket.ticket_number,
          message: ticket.ticket_number,
        });
      }
    }
    return actions;
  }

  if (staff) {
    return [
      { label: "mine sager", message: "mine sager" },
      { label: "INC-2026-00118", message: "INC-2026-00118" },
    ];
  }

  return [
    { label: "Mine sager", message: "mine sager", autoSend: true },
    { label: "Hjælp", message: "Hjælp", autoSend: true },
  ];
}

export function buildCaseAssistantApiPageContext(
  pageContext: CaseAssistantPageContext,
  ticket?: Pick<Ticket, "id" | "ticket_number" | "title"> | null,
) {
  return {
    page_path: pageContext.pagePath,
    page_label: pageContext.pageLabel,
    ticket_id: ticket?.id ?? pageContext.ticketId,
    ticket_number: ticket?.ticket_number ?? null,
    ticket_title: ticket?.title ?? null,
  };
}
