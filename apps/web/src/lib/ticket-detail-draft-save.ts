import { apiPatch } from "@/lib/api";
import { METADATA_FIELD_CHANGE_REASON } from "@/lib/metadata-search";
import type { TicketDetail } from "@/types/ticket";

export type TicketDetailDraft = {
  category_id: string | null;
  subcategory_id: string | null;
  assigned_team_id: string | null;
  assigned_user_id: string | null;
  priority: string;
  source: string | null;
};

export function ticketToDetailDraft(ticket: TicketDetail): TicketDetailDraft {
  return {
    category_id: ticket.category_id ?? null,
    subcategory_id: ticket.subcategory_id ?? null,
    assigned_team_id: ticket.assigned_team_id ?? null,
    assigned_user_id: ticket.assigned_user_id ?? null,
    priority: ticket.priority,
    source: ticket.source ?? null,
  };
}

export function ticketDetailDraftsEqual(
  a: TicketDetailDraft,
  b: TicketDetailDraft,
): boolean {
  return (
    a.category_id === b.category_id &&
    a.subcategory_id === b.subcategory_id &&
    a.assigned_team_id === b.assigned_team_id &&
    a.assigned_user_id === b.assigned_user_id &&
    a.priority === b.priority &&
    a.source === b.source
  );
}

export async function saveTicketDetailDraft(
  ticketId: string,
  before: TicketDetailDraft,
  after: TicketDetailDraft,
  initialDetail: TicketDetail,
): Promise<TicketDetail> {
  let detail = initialDetail;

  const categoryChanged = before.category_id !== after.category_id;
  const subcategoryChanged = before.subcategory_id !== after.subcategory_id;
  const sourceChanged = before.source !== after.source;

  if (categoryChanged || subcategoryChanged || sourceChanged) {
    const metadataPayload: {
      category_id?: string | null;
      subcategory_id?: string | null;
      source?: string;
    } = {};
    if (categoryChanged) {
      metadataPayload.category_id = after.category_id;
      metadataPayload.subcategory_id = after.subcategory_id;
    } else if (subcategoryChanged) {
      metadataPayload.subcategory_id = after.subcategory_id;
    }
    if (sourceChanged && after.source) {
      metadataPayload.source = after.source;
    }
    detail = await apiPatch<TicketDetail>(
      `/api/v1/tickets/${ticketId}/metadata`,
      metadataPayload,
    );
  }

  const assignmentChanged =
    before.assigned_team_id !== after.assigned_team_id ||
    before.assigned_user_id !== after.assigned_user_id;

  if (assignmentChanged) {
    detail = await apiPatch<TicketDetail>(`/api/v1/tickets/${ticketId}/assignment`, {
      assigned_team_id: after.assigned_team_id,
      assigned_user_id: after.assigned_user_id,
    });
  }

  if (before.priority !== after.priority) {
    detail = await apiPatch<TicketDetail>(`/api/v1/tickets/${ticketId}/priority`, {
      priority: after.priority,
      reason: METADATA_FIELD_CHANGE_REASON,
    });
  }

  return detail;
}
