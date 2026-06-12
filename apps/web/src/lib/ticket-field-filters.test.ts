import { describe, expect, it } from "vitest";

import {
  ASSIGNEE_MINE,
  DEFAULT_TICKET_FIELD_FILTERS,
  NONE_ASSIGNEE,
  NONE_SUBCATEGORY,
  NONE_TEAM,
  applyTicketFieldFilters,
  collectTicketFieldFilterOptions,
  hasActiveTicketFieldFilters,
} from "./ticket-field-filters";
import type { Ticket } from "@/types/ticket";

function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: "t1",
    ticket_number: "INC-42",
    title: "Printer virker ikke",
    description: "Fejl ved udskrift",
    status: "new",
    priority: "high",
    ticket_type: "incident",
    is_major: true,
    is_security_ticket: false,
    sub_causes: [],
    created_at: "2026-06-10T08:00:00.000Z",
    updated_at: "2026-06-10T09:00:00.000Z",
    category_name_da: "Hardware",
    subcategory_name_da: "Printer",
    assigned_team_name: "SF Service Desk",
    assigned_user_name: "Anna",
    assigned_user_id: "user-1",
    reporter_display_name: "Børge",
    tags: ["kontor"],
    comment_count: 2,
    internal_comment_count: 1,
    attachment_count: 1,
    sla_breached: false,
    sla_remaining_seconds: 900,
    source: "portal",
    ...overrides,
  };
}

describe("collectTicketFieldFilterOptions", () => {
  it("collects unique filter option values", () => {
    const options = collectTicketFieldFilterOptions([makeTicket(), makeTicket({ id: "t2" })]);
    expect(options.categories).toContain("Hardware");
    expect(options.tags).toContain("kontor");
    expect(options.statuses).toContain("new");
  });
});

describe("applyTicketFieldFilters", () => {
  const ticket = makeTicket();

  it("matches contains filters case-insensitively", () => {
    expect(
      applyTicketFieldFilters([ticket], {
        ...DEFAULT_TICKET_FIELD_FILTERS,
        title: "printer",
      }),
    ).toHaveLength(1);
    expect(
      applyTicketFieldFilters([ticket], {
        ...DEFAULT_TICKET_FIELD_FILTERS,
        title: "fax",
      }),
    ).toHaveLength(0);
  });

  it("handles none sentinels for subcategory, team and assignee", () => {
    expect(
      applyTicketFieldFilters(
        [
          makeTicket({
            subcategory_name_da: undefined,
            assigned_team_name: undefined,
            assigned_team_id: undefined,
            assigned_user_id: undefined,
            assigned_user_name: undefined,
          }),
        ],
        {
          ...DEFAULT_TICKET_FIELD_FILTERS,
          subcategory: NONE_SUBCATEGORY,
          assigned_team: NONE_TEAM,
          assigned_user: NONE_ASSIGNEE,
        },
      ),
    ).toHaveLength(1);

    expect(
      applyTicketFieldFilters([ticket], {
        ...DEFAULT_TICKET_FIELD_FILTERS,
        assigned_user: ASSIGNEE_MINE,
      }, { currentUserId: "other" }),
    ).toHaveLength(0);

    expect(
      applyTicketFieldFilters([ticket], {
        ...DEFAULT_TICKET_FIELD_FILTERS,
        assigned_user: ASSIGNEE_MINE,
      }, { currentUserId: "user-1" }),
    ).toHaveLength(1);
  });

  it("filters sla, flags and attachment/comment presence", () => {
    expect(
      applyTicketFieldFilters([ticket], {
        ...DEFAULT_TICKET_FIELD_FILTERS,
        sla: "due_soon",
        is_major: "yes",
        has_attachments: "yes",
        has_comments: "yes",
        has_internal_comments: "yes",
        tag: "kontor",
      }),
    ).toHaveLength(1);

    expect(
      applyTicketFieldFilters([ticket], {
        ...DEFAULT_TICKET_FIELD_FILTERS,
        sla: "breached",
      }),
    ).toHaveLength(0);
  });
});

describe("hasActiveTicketFieldFilters", () => {
  it("detects deviations from defaults", () => {
    expect(hasActiveTicketFieldFilters(DEFAULT_TICKET_FIELD_FILTERS)).toBe(false);
    expect(
      hasActiveTicketFieldFilters({
        ...DEFAULT_TICKET_FIELD_FILTERS,
        title: "x",
      }),
    ).toBe(true);
  });
});
