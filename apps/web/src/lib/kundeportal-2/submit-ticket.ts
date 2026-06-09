import { apiPost } from "@/lib/api";
import type { Kp2FormSchema } from "@/lib/kundeportal-2/types";
import { uploadTicketAttachments } from "@/lib/upload-ticket-attachments";
import type { Ticket, TicketCreateInput } from "@/types/ticket";

function mapKp2Priority(raw: unknown): TicketCreateInput["priority"] {
  const value = String(raw ?? "").toLowerCase();
  if (value.includes("kritisk") || value.startsWith("1")) return "critical";
  if (value.includes("høj") || value.startsWith("2")) return "high";
  if (value.includes("lav") || value.startsWith("4")) return "low";
  return "medium";
}

function resolveTicketType(schema: Kp2FormSchema): TicketCreateInput["ticket_type"] {
  if (schema.id.startsWith("fejl-")) return "incident";
  if (schema.id === "eksterne-testcases" || schema.id === "fejlbearbejdning-eksterne") {
    return "incident";
  }
  return "service_request";
}

function buildDescription(
  schema: Kp2FormSchema,
  data: Record<string, string | boolean>,
): string {
  const lines = [`Formular: ${schema.title}`, ""];
  for (const field of schema.fields) {
    const value = data[field.name];
    if (value === undefined || value === "" || value === false) continue;
    const rendered =
      typeof value === "boolean" ? (value ? "Ja" : "Nej") : String(value).trim();
    if (!rendered) continue;
    lines.push(`${field.label}: ${rendered}`);
  }
  lines.push("", "— Oprettet via Kundeportal #2");
  const text = lines.join("\n");
  return text.length >= 10 ? text : `${text}\n(ingen yderligere oplysninger)`;
}

function resolveTitle(
  schema: Kp2FormSchema,
  data: Record<string, string | boolean>,
): string {
  const rawTitle = data.titel ?? data.title;
  if (typeof rawTitle === "string" && rawTitle.trim().length >= 3) {
    return rawTitle.trim().slice(0, 256);
  }
  return schema.title.slice(0, 256);
}

function buildIntakeAnswers(
  schema: Kp2FormSchema,
  data: Record<string, string | boolean>,
): Record<string, string> {
  const answers: Record<string, string> = {
    kp2_form_id: schema.id,
    kp2_form_title: schema.title,
  };
  for (const field of schema.fields) {
    const value = data[field.name];
    if (typeof value === "string" && value.trim()) {
      answers[field.name] = value.trim();
    } else if (value === true) {
      answers[field.name] = "Ja";
    }
  }
  return answers;
}

export async function submitKp2Ticket(
  schema: Kp2FormSchema,
  data: Record<string, string | boolean>,
  files: File[],
): Promise<Ticket> {
  const payload: TicketCreateInput = {
    ticket_type: resolveTicketType(schema),
    title: resolveTitle(schema, data),
    description: buildDescription(schema, data),
    priority: data.prioritet ? mapKp2Priority(data.prioritet) : "medium",
    gdpr_consent: Boolean(data.gdpr_bekraeftelse),
    tags: ["kundeportal-2", schema.id],
    intake_answers: buildIntakeAnswers(schema, data),
  };

  const ticket = await apiPost<Ticket>("/api/v1/tickets", payload);
  if (files.length > 0) {
    await uploadTicketAttachments(ticket.id, files);
  }
  return ticket;
}