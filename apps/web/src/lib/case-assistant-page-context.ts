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
  | "reports"
  | "analytics"
  | "kanban"
  | "backlog"
  | "admin"
  | "users"
  | "assets"
  | "groups"
  | "integrations"
  | "portal"
  | "profile"
  | "forbedringer"
  | "classic"
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
  "/min-side": "Min side",
  "/service-desk": "Service Desk",
  "/kanban": "Kanban",
  "/backlog": "Backlog",
  "/tickets": "Alle sager",
  "/tickets/new": "Ny sag",
  "/tickets/major": "Store sager",
  "/knowledge": "Vidensartikler",
  "/knowledge/new": "Ny vidensartikel",
  "/reports": "Rapporter",
  "/reports/analytics": "Avanceret sagsanalyse",
  "/aktiver": "Aktiver",
  "/groups": "Grupper",
  "/users": "Brugere",
  "/portal": "Selvbetjeningsportal",
  "/profile": "Profil",
  "/skift-adgangskode": "Skift adgangskode",
  "/forbedringer": "Review-sedler",
  "/forbedringer/saglayout-2": "Saglayout #2",
  "/integrations": "Integrationer",
  "/admin/dashboard": "Admin dashboard",
  "/admin/chatbot": "Chatbot-indstillinger",
  "/admin/sla": "SLA-indstillinger",
  "/admin/categories": "Kategorier",
  "/admin/dependencies": "Afhængigheder & sikkerhed",
  "/classic": "Classic UI",
  "/classic/incidents": "Classic — Incidents",
  "/classic/changes": "Classic — Changes",
  "/classic/problems": "Classic — Problems",
  "/classic/service-requests": "Classic — Service requests",
  "/classic/my-work": "Classic — Mit arbejde",
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
  if (pathname.startsWith("/reports/analytics")) {
    return "analytics";
  }
  if (pathname.startsWith("/reports")) {
    return "reports";
  }
  if (pathname.startsWith("/kanban")) {
    return "kanban";
  }
  if (pathname.startsWith("/backlog")) {
    return "backlog";
  }
  if (pathname.startsWith("/admin")) {
    return "admin";
  }
  if (pathname.startsWith("/users")) {
    return "users";
  }
  if (pathname.startsWith("/aktiver")) {
    return "assets";
  }
  if (pathname.startsWith("/groups")) {
    return "groups";
  }
  if (pathname.startsWith("/integrations")) {
    return "integrations";
  }
  if (pathname.startsWith("/portal")) {
    return "portal";
  }
  if (pathname.startsWith("/profile") || pathname.startsWith("/skift-adgangskode")) {
    return "profile";
  }
  if (pathname.startsWith("/forbedringer")) {
    return "forbedringer";
  }
  if (pathname.startsWith("/classic")) {
    return "classic";
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
  if (kind === "admin") {
    const segment = pathname.split("/").filter(Boolean).slice(1).join(" ");
    return segment ? `Admin — ${segment.replace(/-/g, " ")}` : "Administration";
  }
  if (kind === "integrations") {
    const segment = pathname.split("/").filter(Boolean).slice(1).join(" ");
    return segment ? `Integration — ${segment.replace(/-/g, " ")}` : "Integrationer";
  }
  if (kind === "knowledge" && pathname.includes("/")) {
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length > 1 && parts[1] !== "new") {
      return "Vidensartikel";
    }
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
    return staff
      ? `Hej${namePart}! Du er i **${pageContext.pageLabel}**. Spørg om emner, artikler eller søgning i vidensbasen.`
      : `Hej${namePart}! Du er i vidensbasen. Spørg fx om VPN, MitID eller andre emner.`;
  }

  if (pageContext.kind === "reports") {
    return staff
      ? [
          `Hej${namePart}! Jeg kan se, du er på **${pageContext.pageLabel}**.`,
          "",
          "Her får du overblik over Service Desk KPI'er. Jeg kan fx:",
          "• Forklare hvad tallene betyder",
          "• Guide dig til den rigtige rapport",
          "• Hjælpe med filtre og eksport",
        ].join("\n")
      : `Hej${namePart}! Du er på **${pageContext.pageLabel}**. Spørg hvis du har brug for hjælp.`;
  }

  if (pageContext.kind === "analytics") {
    return staff
      ? [
          `Hej${namePart}! Du er i **${pageContext.pageLabel}**.`,
          "",
          "Jeg kan hjælpe med:",
          "• At læse grafer og trends",
          "• Observability og sagspipeline",
          "• Filtre og tidsperioder",
        ].join("\n")
      : `Hej${namePart}! Du er i **${pageContext.pageLabel}**. Spørg hvis du har brug for hjælp.`;
  }

  if (pageContext.kind === "kanban") {
    return staff
      ? `Hej${namePart}! Du er på **Kanban**. Jeg kan hjælpe med boards, kolonner, WIP-grænser og arbejdsflow.`
      : `Hej${namePart}! Du er på **Kanban**. Spørg hvis du har brug for hjælp.`;
  }

  if (pageContext.kind === "backlog") {
    return staff
      ? `Hej${namePart}! Du er i **Backlog**. Spørg om prioritering, sprint-planlægning eller sagsstatus.`
      : `Hej${namePart}! Du er i **Backlog**. Spørg hvis du har brug for hjælp.`;
  }

  if (pageContext.kind === "dashboard") {
    return staff
      ? `Hej${namePart}! Du er på **${pageContext.pageLabel}**. Her ser du drifts-KPI'er — spørg fx om SLA, køer eller dagens overblik.`
      : `Hej${namePart}! Velkommen til **${pageContext.pageLabel}**. Spørg om dine sager eller IT-hjælp.`;
  }

  if (pageContext.kind === "admin") {
    return staff
      ? `Hej${namePart}! Du er i **${pageContext.pageLabel}**. Spørg om indstillinger, konfiguration eller hvad denne side gør.`
      : `Hej${namePart}! Spørg hvis du har brug for hjælp.`;
  }

  if (pageContext.kind === "users") {
    return staff
      ? `Hej${namePart}! Du er i **Brugere**. Jeg kan hjælpe med roller, adgang og brugeradministration.`
      : `Hej${namePart}! Spørg hvis du har brug for hjælp.`;
  }

  if (pageContext.kind === "assets") {
    return staff
      ? `Hej${namePart}! Du er i **Aktiver**. Spørg om CMDB, udstyr eller tilknytning til sager.`
      : `Hej${namePart}! Spørg hvis du har brug for hjælp.`;
  }

  if (pageContext.kind === "groups") {
    return staff
      ? `Hej${namePart}! Du er i **Grupper**. Spørg om team-tildeling, eskalering eller gruppeindstillinger.`
      : `Hej${namePart}! Spørg hvis du har brug for hjælp.`;
  }

  if (pageContext.kind === "integrations") {
    return staff
      ? `Hej${namePart}! Du er i **${pageContext.pageLabel}**. Spørg om opsætning, synkronisering eller fejlfinding.`
      : `Hej${namePart}! Spørg hvis du har brug for hjælp.`;
  }

  if (pageContext.kind === "portal") {
    return staff
      ? `Hej${namePart}! Du kigger på **${pageContext.pageLabel}** (slutbruger-visning). Spørg om portal-flows og selvbetjening.`
      : `Hej${namePart}! Velkommen i selvbetjeningen. Spørg om dine sager, vejledninger eller opret en ny sag.`;
  }

  if (pageContext.kind === "profile") {
    return staff
      ? `Hej${namePart}! Du er på **${pageContext.pageLabel}**. Spørg hvis du har brug for hjælp til profil eller adgangskode.`
      : `Hej${namePart}! Her kan du administrere din profil. Spørg hvis du har brug for hjælp.`;
  }

  if (pageContext.kind === "forbedringer") {
    return staff
      ? `Hej${namePart}! Du er i **${pageContext.pageLabel}**. Spørg om review-sedler, layout-forslag eller forbedringsarbejde.`
      : `Hej${namePart}! Spørg hvis du har brug for hjælp.`;
  }

  if (pageContext.kind === "classic") {
    return staff
      ? `Hej${namePart}! Du er i **${pageContext.pageLabel}** (Classic UI). Jeg kan hjælpe med sager, incidents og ændringer.`
      : `Hej${namePart}! Spørg hvis du har brug for hjælp.`;
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

  return `Hej${namePart}! Du er på **${pageContext.pageLabel}**. Skriv \`mine sager\`, sagsnummer, eller \`opret Titel - Beskrivelse\`. Mikrofonen virker også.`;
}

export function getCaseAssistantQuickActions(options: {
  staff: boolean;
  pageContext: CaseAssistantPageContext;
  ticket?: Pick<Ticket, "ticket_number"> | null;
}): CaseAssistantQuickAction[] {
  const { staff, pageContext, ticket } = options;
  const { kind } = pageContext;

  if (kind === "ticket-detail") {
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

  if (kind === "reports") {
    return [
      { label: "Forklar KPI'er", message: "Forklar KPI'erne på rapportsiden", autoSend: true },
      { label: "Hvilken rapport?", message: "Hvilken rapport skal jeg bruge til mit formål?", autoSend: true },
      { label: "Gå til analyse", message: "Hvad kan jeg se under avanceret sagsanalyse?", autoSend: true },
    ];
  }

  if (kind === "analytics") {
    return [
      { label: "Læs grafer", message: "Hvordan læser jeg graferne på denne side?", autoSend: true },
      { label: "Trends", message: "Forklar trends og observability her", autoSend: true },
    ];
  }

  if (kind === "kanban") {
    return [
      { label: "Kanban-hjælp", message: "Hvordan bruger jeg Kanban-boardet?", autoSend: true },
      { label: "mine sager", message: "mine sager" },
    ];
  }

  if (kind === "backlog") {
    return [
      { label: "Prioritering", message: "Hvordan prioriterer jeg backlog?", autoSend: true },
      { label: "mine sager", message: "mine sager" },
    ];
  }

  if (kind === "dashboard") {
    return [
      { label: "Dagens overblik", message: "Giv mig et kort overblik over dagens drift", autoSend: true },
      { label: "mine sager", message: "mine sager" },
    ];
  }

  if (kind === "knowledge") {
    return [
      { label: "Søg vidensbase", message: "Hvordan søger jeg i vidensbasen?", autoSend: true },
      { label: "VPN", message: "Hjælp med VPN", autoSend: true },
    ];
  }

  if (kind === "create-ticket") {
    return [{ label: "Kategorier", message: "Hvilken kategori skal jeg vælge?", autoSend: true }];
  }

  if (kind === "admin") {
    return [
      {
        label: "Hvad gør siden?",
        message: `Hvad kan jeg gøre på ${pageContext.pageLabel}?`,
        autoSend: true,
      },
    ];
  }

  if (kind === "users") {
    return [{ label: "Roller", message: "Forklar brugerroller og adgang", autoSend: true }];
  }

  if (kind === "integrations") {
    return [
      { label: "Opsætning", message: "Hvordan opsætter jeg denne integration?", autoSend: true },
    ];
  }

  if (kind === "portal") {
    return [
      { label: "Mine sager", message: "mine sager", autoSend: true },
      { label: "Opret sag", message: "Hvordan opretter jeg en ny sag?", autoSend: true },
    ];
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
    page_kind: pageContext.kind,
    ticket_id: ticket?.id ?? pageContext.ticketId,
    ticket_number: ticket?.ticket_number ?? null,
    ticket_title: ticket?.title ?? null,
  };
}
