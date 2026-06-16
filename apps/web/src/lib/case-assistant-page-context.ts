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
  "/": "Hjem",
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
  "/indstillinger": "Personlige indstillinger",
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

export type CaseAssistantWelcomeMessages = {
  general: string;
  pageSpecific: string;
};

function firstName(displayName?: string | null): string {
  if (!displayName?.trim()) {
    return "";
  }
  return ` ${displayName.trim().split(/\s+/)[0]}`;
}

export function buildCaseAssistantWelcomeMessages(options: {
  staff: boolean;
  displayName?: string | null;
  pageContext: CaseAssistantPageContext;
  ticket?: Pick<Ticket, "ticket_number" | "title"> | null;
}): CaseAssistantWelcomeMessages {
  const { staff, displayName, pageContext, ticket } = options;
  const namePart = firstName(displayName);

  const general = staff
    ? `Hej${namePart}! Hvad kan jeg hjælpe med i dag?`
    : `Hej${namePart}! Hvad har du brug for hjælp til?`;

  const pageSpecific = buildCaseAssistantPageQuestion({
    staff,
    pageContext,
    ticket,
  });

  return { general, pageSpecific };
}

function buildCaseAssistantPageQuestion(options: {
  staff: boolean;
  pageContext: CaseAssistantPageContext;
  ticket?: Pick<Ticket, "ticket_number" | "title"> | null;
}): string {
  const { staff, pageContext, ticket } = options;
  const { kind, pageLabel } = pageContext;

  if (kind === "ticket-detail") {
    const ticketLabel = ticket
      ? `**${ticket.ticket_number}** — ${ticket.title}`
      : "den sag, du kigger på";

    return staff
      ? `Du er på sagsdetaljer for ${ticketLabel}. Vil du have en opsummering, statusforklaring eller forslag til næste skridt?`
      : `Du kigger på ${ticketLabel}. Vil du have en opsummering eller forklaring på status?`;
  }

  if (kind === "ticket-list") {
    return staff
      ? `Du er i **${pageLabel}**. Vil du søge et sagsnummer, se mine sager eller få hjælp til filtre?`
      : `Du er i **${pageLabel}**. Vil du se dine sager eller søge på et sagsnummer?`;
  }

  if (kind === "create-ticket") {
    return `Du opretter en ny sag. Vil du have hjælp til kategori, titel eller beskrivelse?`;
  }

  if (kind === "service-desk") {
    return staff
      ? `Du er på **Service Desk**. Vil du hjælpe med sagsopslag, køen eller fordeling af nye sager?`
      : `Du er på **Service Desk**. Vil du finde en sag eller få hjælp med en henvendelse?`;
  }

  if (kind === "knowledge") {
    return staff
      ? `Du er i **${pageLabel}**. Vil du søge artikler, finde et emne eller få hjælp til vidensbasen?`
      : `Du er i vidensbasen. Vil du søge vejledninger — fx VPN, MitID eller andre emner?`;
  }

  if (kind === "reports") {
    return staff
      ? `Du er på **${pageLabel}**. Vil du forstå KPI'erne, finde den rigtige rapport eller få hjælp til eksport?`
      : `Du er på **${pageLabel}**. Vil du have hjælp til at læse tallene eller finde det du leder efter?`;
  }

  if (kind === "analytics") {
    return staff
      ? `Du er i **${pageLabel}**. Vil du have hjælp til at læse grafer, trends eller filtre på siden?`
      : `Du er i **${pageLabel}**. Vil du have hjælp til at forstå det du ser her?`;
  }

  if (kind === "kanban") {
    return staff
      ? `Du er på **Kanban**. Vil du have hjælp til boards, kolonner, WIP-grænser eller arbejdsflow?`
      : `Du er på **Kanban**. Vil du have hjælp til at bruge boardet?`;
  }

  if (kind === "backlog") {
    return staff
      ? `Du er i **Backlog**. Vil du prioritere sager, planlægge sprint eller få overblik over køen?`
      : `Du er i **Backlog**. Vil du have hjælp til at finde eller prioritere sager?`;
  }

  if (kind === "dashboard") {
    return staff
      ? `Du er på **${pageLabel}**. Vil du bruge sitemapet, åbne arbejdsrum eller få et hurtigt overblik over dagens drift?`
      : `Du er på **${pageLabel}**. Vil du finde en side, se dine sager eller få IT-hjælp?`;
  }

  if (kind === "admin") {
    return staff
      ? `Du er i **${pageLabel}**. Vil du have hjælp til indstillinger, konfiguration eller hvad denne side gør?`
      : `Du er på **${pageLabel}**. Vil du have hjælp til at bruge siden?`;
  }

  if (kind === "users") {
    return staff
      ? `Du er i **Brugere**. Vil du have hjælp til roller, adgang eller brugeradministration?`
      : `Du er i **Brugere**. Vil du have hjælp til at finde eller administrere brugere?`;
  }

  if (kind === "assets") {
    return staff
      ? `Du er i **Aktiver**. Vil du søge udstyr, CMDB eller tilknytte aktiver til sager?`
      : `Du er i **Aktiver**. Vil du finde eller forstå et aktiv?`;
  }

  if (kind === "groups") {
    return staff
      ? `Du er i **Grupper**. Vil du have hjælp til team-tildeling, eskalering eller gruppeindstillinger?`
      : `Du er i **Grupper**. Vil du have hjælp til at finde eller forstå en gruppe?`;
  }

  if (kind === "integrations") {
    return staff
      ? `Du er i **${pageLabel}**. Vil du opsætte, synkronisere eller fejlfinde denne integration?`
      : `Du er i **${pageLabel}**. Vil du have hjælp til integrationen?`;
  }

  if (kind === "portal") {
    return staff
      ? `Du kigger på **${pageLabel}** (slutbruger-visning). Vil du forstå portal-flows eller selvbetjening?`
      : `Du er i selvbetjeningen. Vil du se dine sager, læse vejledninger eller oprette en ny sag?`;
  }

  if (kind === "profile") {
    return staff
      ? `Du er på **${pageLabel}**. Vil du have hjælp til profil, avatar eller adgangskode?`
      : `Du er på **${pageLabel}**. Vil du opdatere profil eller skifte adgangskode?`;
  }

  if (kind === "forbedringer") {
    return staff
      ? `Du er i **${pageLabel}**. Vil du arbejde med review-sedler, layout-forslag eller forbedringer?`
      : `Du er i **${pageLabel}**. Vil du have hjælp til siden?`;
  }

  if (kind === "classic") {
    return staff
      ? `Du er i **${pageLabel}** (Classic UI). Vil du hjælpe med sager, incidents eller ændringer?`
      : `Du er i **${pageLabel}**. Vil du have hjælp til at bruge Classic UI?`;
  }

  if (staff) {
    return `Du er på **${pageLabel}**. Vil du søge en sag, se mine sager eller oprette en ny henvendelse?`;
  }

  return `Du er på **${pageLabel}**. Vil du se mine sager, søge et sagsnummer eller oprette en sag?`;
}

export function buildCaseAssistantWelcome(options: {
  staff: boolean;
  displayName?: string | null;
  pageContext: CaseAssistantPageContext;
  ticket?: Pick<Ticket, "ticket_number" | "title"> | null;
}): string {
  const { general, pageSpecific } = buildCaseAssistantWelcomeMessages(options);
  return `${general}\n\n${pageSpecific}`;
}

export function getCaseAssistantQuickActions(options: {
  staff: boolean;
  pageContext: CaseAssistantPageContext;
  ticket?: Pick<Ticket, "ticket_number"> | null;
}): CaseAssistantQuickAction[] {
  const { staff, pageContext, ticket } = options;
  const { kind } = pageContext;

  const generalAction: CaseAssistantQuickAction = staff
    ? {
        label: "Generel hjælp",
        message: "Hvad kan du hjælpe mig med generelt?",
        autoSend: true,
      }
    : {
        label: "Hvad kan du hjælpe med?",
        message: "Hvad kan du hjælpe mig med?",
        autoSend: true,
      };

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
    return [generalAction, ...actions];
  }

  if (kind === "reports") {
    return [
      generalAction,
      { label: "Forklar KPI'er", message: "Forklar KPI'erne på rapportsiden", autoSend: true },
      { label: "Hvilken rapport?", message: "Hvilken rapport skal jeg bruge til mit formål?", autoSend: true },
      { label: "Gå til analyse", message: "Hvad kan jeg se under avanceret sagsanalyse?", autoSend: true },
    ];
  }

  if (kind === "analytics") {
    return [
      generalAction,
      { label: "Læs grafer", message: "Hvordan læser jeg graferne på denne side?", autoSend: true },
      { label: "Trends", message: "Forklar trends og observability her", autoSend: true },
    ];
  }

  if (kind === "kanban") {
    return [
      generalAction,
      { label: "Kanban-hjælp", message: "Hvordan bruger jeg Kanban-boardet?", autoSend: true },
      { label: "mine sager", message: "mine sager" },
    ];
  }

  if (kind === "backlog") {
    return [
      generalAction,
      { label: "Prioritering", message: "Hvordan prioriterer jeg backlog?", autoSend: true },
      { label: "mine sager", message: "mine sager" },
    ];
  }

  if (kind === "dashboard") {
    return [
      generalAction,
      { label: "Dagens overblik", message: "Giv mig et kort overblik over dagens drift", autoSend: true },
      { label: "mine sager", message: "mine sager" },
    ];
  }

  if (kind === "knowledge") {
    return [
      generalAction,
      { label: "Søg vidensbase", message: "Hvordan søger jeg i vidensbasen?", autoSend: true },
      { label: "VPN", message: "Hjælp med VPN", autoSend: true },
    ];
  }

  if (kind === "create-ticket") {
    return [
      generalAction,
      { label: "Kategorier", message: "Hvilken kategori skal jeg vælge?", autoSend: true },
    ];
  }

  if (kind === "admin") {
    return [
      generalAction,
      {
        label: "Hvad gør siden?",
        message: `Hvad kan jeg gøre på ${pageContext.pageLabel}?`,
        autoSend: true,
      },
    ];
  }

  if (kind === "users") {
    return [
      generalAction,
      { label: "Roller", message: "Forklar brugerroller og adgang", autoSend: true },
    ];
  }

  if (kind === "integrations") {
    return [
      generalAction,
      { label: "Opsætning", message: "Hvordan opsætter jeg denne integration?", autoSend: true },
    ];
  }

  if (kind === "portal") {
    return [
      generalAction,
      { label: "Mine sager", message: "mine sager", autoSend: true },
      { label: "Opret sag", message: "Hvordan opretter jeg en ny sag?", autoSend: true },
    ];
  }

  if (staff) {
    return [
      generalAction,
      { label: "mine sager", message: "mine sager" },
      { label: "INC-2026-00118", message: "INC-2026-00118" },
    ];
  }

  return [
    generalAction,
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
