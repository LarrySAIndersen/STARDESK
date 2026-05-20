import type { AssetSystem } from "@/types/asset";
import type { Ticket } from "@/types/ticket";

export type CaseAssistantLink = {
  href: string;
  label: string;
};

export type CaseAssistantReply = {
  body: string;
  links?: CaseAssistantLink[];
};

export type CaseAssistantContext = {
  tickets: Ticket[];
  systems: AssetSystem[];
  userDisplayName?: string | null;
};

const TICKET_NUMBER_RE = /\b([A-Z]{2,}(?:-[A-Z0-9]+)+-\d{3,}|[A-Z]{2,}-\d{4,})\b/i;
const UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

function ticketHref(ticket: Ticket): string {
  return `/tickets/${ticket.id}`;
}

function statusLabelDa(status: string): string {
  const map: Record<string, string> = {
    received: "Modtaget",
    in_progress: "Igangsat",
    resolved: "Løst",
    closed: "Lukket",
  };
  return map[status] ?? status;
}

function priorityLabelDa(priority: string): string {
  const map: Record<string, string> = {
    low: "Lav",
    medium: "Mellem",
    high: "Høj",
    critical: "Kritisk",
  };
  return map[priority] ?? priority;
}

function findTicketReference(
  text: string,
  tickets: Ticket[],
): Ticket | null {
  const numMatch = text.match(TICKET_NUMBER_RE);
  if (numMatch) {
    const ref = numMatch[1].toUpperCase();
    const byNumber = tickets.find(
      (t) => t.ticket_number.toUpperCase() === ref,
    );
    if (byNumber) return byNumber;
  }
  const uuidMatch = text.match(UUID_RE);
  if (uuidMatch) {
    const byId = tickets.find((t) => t.id === uuidMatch[0]);
    if (byId) return byId;
  }
  const lower = normalize(text);
  const byTitle = tickets.find((t) => lower.includes(t.title.toLowerCase().slice(0, 24)));
  return byTitle ?? null;
}

function findSystemReference(
  text: string,
  systems: AssetSystem[],
): AssetSystem | null {
  const lower = normalize(text);
  for (const system of systems) {
    if (
      lower.includes(system.name.toLowerCase()) ||
      lower.includes(system.code.toLowerCase())
    ) {
      return system;
    }
    for (const sub of system.subsystems) {
      if (
        lower.includes(sub.name.toLowerCase()) ||
        lower.includes(sub.code.toLowerCase())
      ) {
        return system;
      }
    }
  }
  return null;
}

/** Mock operational status for demo (not live monitoring). */
function mockSystemStatus(system: AssetSystem): "ok" | "degraded" | "maintenance" {
  const hash = system.code.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  if (hash % 7 === 0) return "maintenance";
  if (hash % 5 === 0) return "degraded";
  return "ok";
}

function statusEmoji(status: "ok" | "degraded" | "maintenance"): string {
  if (status === "ok") return "🟢";
  if (status === "degraded") return "🟡";
  return "🔵";
}

function formatTicketSummary(t: Ticket): string {
  const lines = [
    `**${t.ticket_number}** — ${t.title}`,
    `Status: ${statusLabelDa(t.status)} · Prioritet: ${priorityLabelDa(t.priority)}`,
  ];
  if (t.source_label_da) {
    lines.push(`Kilde: ${t.source_label_da}`);
  }
  if (t.assigned_team_name) {
    lines.push(`Team: ${t.assigned_team_name}`);
  }
  if (t.sla_breached) {
    lines.push("⚠ SLA er overskredet");
  } else if (t.sla_remaining_seconds != null && t.sla_remaining_seconds > 0) {
    const hours = Math.round(t.sla_remaining_seconds / 3600);
    lines.push(`SLA: ca. ${hours} timer tilbage`);
  }
  if (t.description?.trim()) {
    const excerpt =
      t.description.length > 160
        ? `${t.description.slice(0, 160).trim()}…`
        : t.description.trim();
    lines.push(`Beskrivelse: ${excerpt}`);
  }
  return lines.join("\n");
}

function replyMineTickets(ctx: CaseAssistantContext): CaseAssistantReply {
  const mine = ctx.tickets.filter((t) => !t.is_major && !t.is_shared);
  if (mine.length === 0) {
    return {
      body: "Du har ingen egne sager endnu. Vil du oprette en?",
      links: [{ href: "/tickets/new", label: "Opret ny sag" }],
    };
  }
  const open = mine.filter((t) => t.status !== "closed" && t.status !== "resolved");
  const lines = [
    `Du har **${mine.length}** sag${mine.length === 1 ? "" : "er"} (${open.length} åbne).`,
    "",
    ...mine.slice(0, 8).map((t) => `• ${t.ticket_number}: ${t.title} (${statusLabelDa(t.status)})`),
  ];
  if (mine.length > 8) {
    lines.push(`… og ${mine.length - 8} mere.`);
  }
  lines.push("", "Skriv et sagsnummer (fx DEMO-2026-0001) for detaljer.");
  return {
    body: lines.join("\n"),
    links: mine.slice(0, 5).map((t) => ({
      href: ticketHref(t),
      label: t.ticket_number,
    })),
  };
}

function replyTicketDetail(ticket: Ticket): CaseAssistantReply {
  return {
    body: formatTicketSummary(ticket),
    links: [{ href: ticketHref(ticket), label: "Åbn sag" }],
  };
}

function replySystems(ctx: CaseAssistantContext): CaseAssistantReply {
  const lines = [
    "**IT-systemer (mock)** — overordnet status:",
    "",
    ...ctx.systems.map((s) => {
      const st = mockSystemStatus(s);
      return `${statusEmoji(st)} **${s.name}** (${s.code}) — ${st === "ok" ? "Normal drift" : st === "degraded" ? "Nedsat" : "Planlagt vedligehold"}`;
    }),
    "",
    "Spørg fx «status på Portal» eller «systemer Integration».",
  ];
  return { body: lines.join("\n") };
}

function replySystemDetail(system: AssetSystem): CaseAssistantReply {
  const st = mockSystemStatus(system);
  const subs = system.subsystems.map((sub) => `• ${sub.name} (${sub.code})`).join("\n");
  return {
    body: [
      `${statusEmoji(st)} **${system.name}** (${system.code})`,
      `Status (mock): ${st === "ok" ? "Normal drift" : st === "degraded" ? "Nedsat ydelse" : "Vedligehold"}`,
      "",
      "Undersystemer:",
      subs || "—",
      "",
      "Dette er demonstrationsdata — ikke live overvågning.",
    ].join("\n"),
  };
}

function replyHelp(ctx: CaseAssistantContext): CaseAssistantReply {
  const first = ctx.userDisplayName?.split(" ")[0];
  return {
    body: [
      first ? `Hej ${first}!` : "Hej!",
      "Jeg er **Sag-assistenten** (mock) og kan hjælpe med:",
      "",
      "• **Mine sager** — oversigt over dine egne sager",
      "• **En sag** — skriv sagsnummer (fx DEMO-2026-0001)",
      "• **Systemer** — status på IT-systemer og undersystemer",
      "• **Opret sag** — link til ny henvendelse",
      "",
      "Eksempler: «vis mine sager», «status på STAR Platform», «sag DEMO-2026-0002»",
    ].join("\n"),
  };
}

/**
 * Rule-based mock replies for portal case assistant (no external LLM).
 */
export function mockCaseAssistantReply(
  userText: string,
  ctx: CaseAssistantContext,
): CaseAssistantReply {
  const text = userText.trim();
  if (!text) {
    return { body: "Skriv et spørgsmål — eller vælg et forslag nedenfor." };
  }

  const lower = normalize(text);

  if (
    /^(hej|hello|hi|godmorgen|goddag)\b/.test(lower) ||
    lower === "hjælp" ||
    lower === "help" ||
    lower.includes("hvad kan du")
  ) {
    return replyHelp(ctx);
  }

  if (
    lower.includes("opret") &&
    (lower.includes("sag") || lower.includes("henvend"))
  ) {
    return {
      body: "Du kan oprette en ny sag med titel, beskrivelse og kategori.",
      links: [{ href: "/tickets/new", label: "Opret ny sag" }],
    };
  }

  if (
    lower.includes("mine sager") ||
    lower.includes("egne sager") ||
    lower.includes("mine egne") ||
    lower === "mine" ||
    lower.includes("hvor mange sager")
  ) {
    return replyMineTickets(ctx);
  }

  const ticketRef = findTicketReference(text, ctx.tickets);
  if (
    ticketRef &&
    (lower.includes("sag") ||
      TICKET_NUMBER_RE.test(text) ||
      UUID_RE.test(text) ||
      lower.includes("status") ||
      lower.includes("prioritet") ||
      lower.includes("sla"))
  ) {
    return replyTicketDetail(ticketRef);
  }

  if (
    lower.includes("system") ||
    lower.includes("drift") ||
    lower.includes("nedetid") ||
    lower.includes("status på")
  ) {
    const system = findSystemReference(text, ctx.systems);
    if (system) {
      return replySystemDetail(system);
    }
    return replySystems(ctx);
  }

  const looseTicket = findTicketReference(text, ctx.tickets);
  if (looseTicket) {
    return replyTicketDetail(looseTicket);
  }

  return {
    body: [
      "Det forstod jeg ikke helt (mock-assistent).",
      "",
      "Prøv fx:",
      "• «Vis mine sager»",
      "• «Systemer»",
      "• Et sagsnummer fra listen",
      "• «Opret sag»",
    ].join("\n"),
  };
}

export const CASE_ASSISTANT_SUGGESTIONS = [
  "Vis mine sager",
  "Systemstatus",
  "Hjælp",
] as const;
