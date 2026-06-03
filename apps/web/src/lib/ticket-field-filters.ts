import { ticketSourceFilterValue } from "@/lib/service-desk-table-filters";
import type { Ticket } from "@/types/ticket";

/** Filters aligned with saga detail fields (Detaljer + header). */
export type TicketFieldFilters = {
  ticket_number: string;
  title: string;
  description: string;
  status: string;
  category: string;
  subcategory: string;
  assigned_team: string;
  assigned_user: string;
  priority: string;
  source: string;
  reporter: string;
  sla: "" | "breached" | "due_soon" | "ok";
  ticket_type: string;
  is_major: "" | "yes" | "no";
  is_security: "" | "yes" | "no";
  created_within: "" | "today" | "7d" | "30d";
  updated_within: "" | "today" | "7d" | "30d";
  has_attachments: "" | "yes" | "no";
  has_comments: "" | "yes" | "no";
  has_internal_comments: "" | "yes" | "no";
  tag: string;
  sort: string;
};

export const NONE_SUBCATEGORY = "__none__";
export const NONE_TEAM = "__none__";
export const NONE_ASSIGNEE = "__none__";
export const ASSIGNEE_MINE = "__mine__";

export const DEFAULT_TICKET_FIELD_FILTERS: TicketFieldFilters = {
  ticket_number: "",
  title: "",
  description: "",
  status: "",
  category: "",
  subcategory: "",
  assigned_team: "",
  assigned_user: "",
  priority: "",
  source: "",
  reporter: "",
  sla: "",
  ticket_type: "",
  is_major: "",
  is_security: "",
  created_within: "",
  updated_within: "",
  has_attachments: "",
  has_comments: "",
  has_internal_comments: "",
  tag: "",
  sort: "sla_asc",
};

export type TicketFieldFilterContext = {
  currentUserId?: string;
};

function normalizeContains(value: string): string {
  return value.trim().toLocaleLowerCase("da");
}

function matchesContains(haystack: string | null | undefined, needle: string): boolean {
  const q = normalizeContains(needle);
  if (!q) {
    return true;
  }
  return (haystack ?? "").toLocaleLowerCase("da").includes(q);
}

function isWithinPeriod(iso: string | null | undefined, period: TicketFieldFilters["created_within"]): boolean {
  if (!period || !iso) {
    return !period;
  }
  const ts = new Date(iso).getTime();
  const now = Date.now();
  if (period === "today") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return ts >= start.getTime();
  }
  const days = period === "7d" ? 7 : 30;
  return now - ts <= days * 86_400_000;
}

function matchesYesNo(
  mode: "" | "yes" | "no",
  predicate: boolean,
): boolean {
  if (!mode) {
    return true;
  }
  return mode === "yes" ? predicate : !predicate;
}

export function collectTicketFieldFilterOptions(tickets: Ticket[]) {
  const categories = new Set<string>();
  const subcategories = new Set<string>();
  const teams = new Set<string>();
  const assignees = new Set<string>();
  const reporters = new Set<string>();
  const tags = new Set<string>();
  const statuses = new Set<string>();

  for (const ticket of tickets) {
    if (ticket.category_name_da) {
      categories.add(ticket.category_name_da);
    }
    if (ticket.subcategory_name_da) {
      subcategories.add(ticket.subcategory_name_da);
    }
    if (ticket.assigned_team_name) {
      teams.add(ticket.assigned_team_name);
    }
    if (ticket.assigned_user_name) {
      assignees.add(ticket.assigned_user_name);
    }
    if (ticket.reporter_display_name) {
      reporters.add(ticket.reporter_display_name);
    }
    for (const tag of ticket.tags ?? []) {
      tags.add(tag);
    }
    statuses.add(ticket.status);
  }

  const sortDa = (a: string, b: string) => a.localeCompare(b, "da");

  return {
    categories: [...categories].sort(sortDa),
    subcategories: [...subcategories].sort(sortDa),
    teams: [...teams].sort(sortDa),
    assignees: [...assignees].sort(sortDa),
    reporters: [...reporters].sort(sortDa),
    tags: [...tags].sort(sortDa),
    statuses: [...statuses].sort(sortDa),
  };
}

export function applyTicketFieldFilters(
  tickets: Ticket[],
  filters: TicketFieldFilters,
  context: TicketFieldFilterContext = {},
): Ticket[] {
  return tickets.filter((ticket) => {
    if (!matchesContains(ticket.ticket_number, filters.ticket_number)) {
      return false;
    }
    if (!matchesContains(ticket.title, filters.title)) {
      return false;
    }
    if (!matchesContains(ticket.description, filters.description)) {
      return false;
    }
    if (filters.status && ticket.status !== filters.status) {
      return false;
    }
    if (filters.category && ticket.category_name_da !== filters.category) {
      return false;
    }
    if (filters.subcategory === NONE_SUBCATEGORY) {
      if (ticket.subcategory_name_da) {
        return false;
      }
    } else if (filters.subcategory && ticket.subcategory_name_da !== filters.subcategory) {
      return false;
    }
    if (filters.assigned_team === NONE_TEAM) {
      if (ticket.assigned_team_id || ticket.assigned_team_name) {
        return false;
      }
    } else if (filters.assigned_team && ticket.assigned_team_name !== filters.assigned_team) {
      return false;
    }
    if (filters.assigned_user === ASSIGNEE_MINE) {
      if (!context.currentUserId || ticket.assigned_user_id !== context.currentUserId) {
        return false;
      }
    } else if (filters.assigned_user === NONE_ASSIGNEE) {
      if (ticket.assigned_user_id || ticket.assigned_user_name) {
        return false;
      }
    } else if (filters.assigned_user && ticket.assigned_user_name !== filters.assigned_user) {
      return false;
    }
    if (filters.priority && ticket.priority !== filters.priority) {
      return false;
    }
    if (filters.source && ticketSourceFilterValue(ticket) !== filters.source) {
      return false;
    }
    if (filters.reporter && ticket.reporter_display_name !== filters.reporter) {
      return false;
    }
    if (filters.sla === "breached" && !ticket.sla_breached) {
      return false;
    }
    if (filters.sla === "due_soon") {
      const remaining = ticket.sla_remaining_seconds;
      if (remaining == null || remaining < 0 || remaining > 3600) {
        return false;
      }
    }
    if (filters.sla === "ok" && ticket.sla_breached) {
      return false;
    }
    if (filters.ticket_type && ticket.ticket_type !== filters.ticket_type) {
      return false;
    }
    if (!matchesYesNo(filters.is_major, Boolean(ticket.is_major))) {
      return false;
    }
    if (!matchesYesNo(filters.is_security, Boolean(ticket.is_security_ticket))) {
      return false;
    }
    if (!isWithinPeriod(ticket.created_at, filters.created_within)) {
      return false;
    }
    if (!isWithinPeriod(ticket.updated_at ?? ticket.created_at, filters.updated_within)) {
      return false;
    }
    const attachmentCount = ticket.attachment_count ?? 0;
    if (!matchesYesNo(filters.has_attachments, attachmentCount > 0)) {
      return false;
    }
    const commentCount = ticket.comment_count ?? 0;
    if (!matchesYesNo(filters.has_comments, commentCount > 0)) {
      return false;
    }
    const internalCount = ticket.internal_comment_count ?? 0;
    if (!matchesYesNo(filters.has_internal_comments, internalCount > 0)) {
      return false;
    }
    if (filters.tag && !(ticket.tags ?? []).includes(filters.tag)) {
      return false;
    }
    return true;
  });
}

export function hasActiveTicketFieldFilters(filters: TicketFieldFilters): boolean {
  return (Object.keys(DEFAULT_TICKET_FIELD_FILTERS) as (keyof TicketFieldFilters)[]).some(
    (key) => filters[key] !== DEFAULT_TICKET_FIELD_FILTERS[key],
  );
}
