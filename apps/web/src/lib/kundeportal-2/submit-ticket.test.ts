import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Kp2FormSchema } from "@/lib/kundeportal-2/types";
import type { Ticket } from "@/types/ticket";

const apiPostMock = vi.fn();
const uploadMock = vi.fn();

vi.mock("@/lib/api", () => ({
  apiPost: (...args: unknown[]) => apiPostMock(...args),
}));

vi.mock("@/lib/upload-ticket-attachments", () => ({
  uploadTicketAttachments: (...args: unknown[]) => uploadMock(...args),
}));

import { submitKp2Ticket } from "@/lib/kundeportal-2/submit-ticket";

const incidentSchema: Kp2FormSchema = {
  id: "fejl-login",
  title: "Fejl ved login",
  category: "fejl-aendringer",
  icon: "alert",
  helpText: "Rapportér loginfejl",
  fields: [
    { name: "titel", label: "Titel", type: "text", required: true },
    { name: "beskrivelse", label: "Beskrivelse", type: "textarea", required: true },
    { name: "prioritet", label: "Prioritet", type: "select", required: false },
    { name: "tags", label: "Tags", type: "tags", required: false },
    { name: "gdpr_bekraeftelse", label: "GDPR", type: "checkbox", required: true },
  ],
};

const createdTicket: Ticket = {
  id: "new-ticket-id",
  ticket_number: "INC-2000",
  title: "Fejl ved login",
  status: "new",
  priority: "medium",
  ticket_type: "incident",
  is_major: false,
  sub_causes: [],
  created_at: "2026-06-10T12:00:00.000Z",
};

describe("submitKp2Ticket", () => {
  beforeEach(() => {
    apiPostMock.mockReset();
    uploadMock.mockReset();
    apiPostMock.mockResolvedValue(createdTicket);
    uploadMock.mockResolvedValue(undefined);
  });

  it("posts ticket with incident type for fejl- schemas", async () => {
    const data = {
      titel: "Kan ikke logge ind",
      beskrivelse: "Fejl ved SSO",
      prioritet: "2 - Høj",
      gdpr_bekraeftelse: true,
      tags: "login, SSO",
    };

    const ticket = await submitKp2Ticket(incidentSchema, data, []);

    expect(ticket).toEqual(createdTicket);
    expect(apiPostMock).toHaveBeenCalledWith(
      "/api/v1/tickets",
      expect.objectContaining({
        ticket_type: "incident",
        title: "Kan ikke logge ind",
        priority: "high",
        source: "portal",
        gdpr_consent: true,
        tags: expect.arrayContaining(["kundeportal-2", "fejl-login", "login", "sso"]),
        intake_answers: expect.objectContaining({
          kp2_form_id: "fejl-login",
          titel: "Kan ikke logge ind",
        }),
      }),
    );
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("uploads attachments when files are provided", async () => {
    const file = new File(["data"], "screenshot.png", { type: "image/png" });
    const data = {
      titel: "Vedhæftet fejl",
      beskrivelse: "Se screenshot",
      gdpr_bekraeftelse: true,
    };

    await submitKp2Ticket(incidentSchema, data, [file]);

    expect(uploadMock).toHaveBeenCalledWith("new-ticket-id", [file]);
  });

  it("uses schema title when user title is too short", async () => {
    const data = {
      titel: "ab",
      beskrivelse: "Beskrivelse af fejl",
      gdpr_bekraeftelse: true,
    };

    await submitKp2Ticket(incidentSchema, data, []);

    expect(apiPostMock).toHaveBeenCalledWith(
      "/api/v1/tickets",
      expect.objectContaining({ title: "Fejl ved login" }),
    );
  });
});
