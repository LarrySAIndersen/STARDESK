import type { Ticket } from "@/types/ticket";

export function wirePriorityBadgeClass(
  priority: string,
): "critical" | "high" | "medium" | "low" {
  if (priority === "critical") return "critical";
  if (priority === "high") return "high";
  if (priority === "low") return "low";
  return "medium";
}

export function wireStatusBadgeClass(
  status: string,
): "open" | "progress" | "resolved" | "pending" {
  if (status === "resolved" || status === "closed") return "resolved";
  if (status === "in_progress") return "progress";
  if (status === "pending" || status === "on_hold") return "pending";
  return "open";
}

/** Deterministic mock AI match score (0–100) for drag-drop prototype. */
export function mockAssignmentConfidence(ticketId: string, memberKey: string): number {
  let hash = 0;
  const s = `${ticketId}:${memberKey}`;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) % 9973;
  }
  return 25 + (hash % 71);
}

export function confidenceColor(score: number): string {
  if (score >= 75) return "#1A7A44";
  if (score >= 50) return "#C87000";
  return "#C8102E";
}

export function confidenceVerdict(score: number): string {
  if (score >= 75) return "God match";
  if (score >= 50) return "Acceptabelt";
  return "Svagt match";
}

export function confidenceVerdictClass(score: number): string {
  if (score >= 75) return "cv-good";
  if (score >= 50) return "cv-ok";
  return "cv-bad";
}

export function bucketInProgressCount(
  buckets: { key: string; count: number }[] | undefined,
): number {
  const igang = buckets?.find((b) => b.key === "igangsat");
  return igang?.count ?? 0;
}

export function ticketDragPayload(ticket: Ticket) {
  return {
    id: ticket.id,
    number: ticket.ticket_number,
    title: ticket.title,
    category: ticket.category_name_da ?? "—",
    priority: ticket.priority,
    status: ticket.status,
    tags: (ticket.tags ?? []).join(","),
    description: ticket.description?.slice(0, 200) ?? "",
  };
}
