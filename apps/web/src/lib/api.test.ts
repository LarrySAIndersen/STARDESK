import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ApiError,
  apiDelete,
  apiGet,
  apiPost,
  apiPostNoContent,
  attachmentDownloadUrl,
} from "./api";

describe("attachmentDownloadUrl", () => {
  it("builds proxy download path for ticket attachments", () => {
    expect(attachmentDownloadUrl("ticket-1", "att-1")).toBe(
      "/api/proxy/v1/tickets/ticket-1/attachments/att-1/download",
    );
  });
});

describe("api client", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("apiGet returns parsed JSON on success", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(apiGet<{ ok: boolean }>("/api/v1/health")).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/health",
      expect.objectContaining({
        cache: "no-store",
        headers: expect.objectContaining({ Accept: "application/json" }),
      }),
    );
  });

  it("apiGet rewrites /api/v1 paths through the browser proxy", async () => {
    vi.stubGlobal("window", {} as Window);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: "1" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await apiGet("/api/v1/tickets");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/proxy/v1/tickets",
      expect.any(Object),
    );
  });

  it("apiGet throws ApiError with session message on 401", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ detail: "invalid token" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(apiGet("/api/v1/me")).rejects.toMatchObject({
      name: "ApiError",
      status: 401,
      message: "invalid token",
    });
  });

  it("apiGet maps deployment protection 401 to Danish session message", async () => {
    fetchMock.mockResolvedValue(
      new Response("API-fejl: 401", {
        status: 401,
        headers: { "content-type": "text/plain" },
      }),
    );

    await expect(apiGet("/api/v1/me")).rejects.toMatchObject({
      status: 401,
      message: "Din session er udløbet. Log ind igen.",
    });
  });

  it("apiPost sends JSON body and parses response", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: "new" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(apiPost<{ id: string }>("/api/v1/tickets", { title: "Test" })).resolves.toEqual({
      id: "new",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/tickets",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ title: "Test" }),
      }),
    );
  });

  it("apiPostNoContent resolves without body on success", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(apiPostNoContent("/api/v1/logout", {})).resolves.toBeUndefined();
  });

  it("apiDelete throws ApiError with status on failure", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ detail: "Not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(apiDelete("/api/v1/tickets/missing")).rejects.toBeInstanceOf(ApiError);
  });
});
