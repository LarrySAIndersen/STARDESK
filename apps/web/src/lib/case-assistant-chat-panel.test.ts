import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildChatApiPayload,
  buildChatArchiveUrl,
  clampFabPosition,
  clampPanelPosition,
  clampPanelSize,
  createChatMessage,
  getCaseAssistantBotLabels,
  getDefaultFabPosition,
  getDefaultPanelPosition,
  getExpandedHeight,
  parseStoredPanelSize,
  parseStoredPoint,
  PANEL_SIZE_PRESETS,
  resolvePanelSizeForPreset,
} from "@/lib/case-assistant-chat-panel";

describe("case-assistant-chat-panel", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("labels staff vs portal bots", () => {
    expect(getCaseAssistantBotLabels(true).botName).toBe("Help-a-bot");
    expect(getCaseAssistantBotLabels(false).fabLabel).toBe("Spørg om sager");
  });

  it("builds archive URL with filters", () => {
    const url = buildChatArchiveUrl({
      userEmail: "anna@example.dk",
      searchQuery: "printer",
      filterCategory: "Hardware",
      onlyBookmarked: true,
    });
    expect(url).toContain("user_email=anna%40example.dk");
    expect(url).toContain("q=printer");
    expect(url).toContain("category=Hardware");
    expect(url).toContain("only_bookmarked=true");
  });

  it("skips Alle category in archive URL", () => {
    const url = buildChatArchiveUrl({
      userEmail: "anna@example.dk",
      filterCategory: "Alle",
    });
    expect(url).not.toContain("category=");
  });

  it("parses stored panel position and size", () => {
    expect(parseStoredPoint(JSON.stringify({ x: 12, y: 34 }))).toEqual({ x: 12, y: 34 });
    expect(parseStoredPoint("not-json")).toBeNull();

    vi.stubGlobal("window", {
      innerWidth: 1200,
      innerHeight: 900,
    } as Window);

    const stored = parseStoredPanelSize(
      JSON.stringify({ preset: "compact", width: 320, height: 400 }),
    );
    expect(stored?.preset).toBe("compact");
    expect(stored?.width).toBeGreaterThanOrEqual(300);
  });

  it("clamps panel and fab positions within viewport", () => {
    vi.stubGlobal("window", {
      innerWidth: 800,
      innerHeight: 600,
    } as Window);

    const panel = clampPanelSize(2000, 2000);
    expect(panel.width).toBeLessThanOrEqual(Math.floor(800 * 0.92));
    expect(panel.height).toBeLessThanOrEqual(Math.floor(600 * 0.88));

    const panelPos = clampPanelPosition(1200, -50, 400, 550);
    expect(panelPos).toEqual({ x: 400, y: 0 });

    const fab = clampFabPosition(900, 900, 180, 52);
    expect(fab.x).toBeLessThanOrEqual(620);
    expect(fab.y).toBeLessThanOrEqual(548);
  });

  it("resolves default positions and presets", () => {
    vi.stubGlobal("window", {
      innerWidth: 1000,
      innerHeight: 800,
    } as Window);

    const panelPos = getDefaultPanelPosition(400, 550);
    expect(panelPos.x).toBeGreaterThan(0);
    expect(panelPos.y).toBeGreaterThan(0);

    const fabPos = getDefaultFabPosition(180, 52);
    expect(fabPos.x).toBeLessThan(1000);

    const expanded = resolvePanelSizeForPreset("expanded");
    expect(expanded.height).toBe(getExpandedHeight());
    expect(expanded.width).toBe(PANEL_SIZE_PRESETS.expanded.width);
  });

  it("builds chat API payload with router and page context", () => {
    const userMsg = createChatMessage("user", "Hej", "-user");
    const payload = buildChatApiPayload({
      messages: [userMsg],
      userEmail: "anna@example.dk",
      userDisplayName: "Anna",
      useName: true,
      activeModel: "gpt-4",
      chatSessionId: "session-1",
      pageContext: {
        page_path: "/",
        page_label: "Dashboard",
        page_kind: "dashboard",
        ticket_id: null,
      },
      customRouter: { url: "https://router", key: "key", model: "m", headerType: "bearer" },
      providerKeys: { openai: "o", anthropic: "a", google: "g" },
    });

    expect(payload.messages).toEqual([{ role: "user", content: "Hej" }]);
    expect(payload.user_name).toBe("Anna");
    expect(payload.custom_router_url).toBe("https://router");
    expect(payload.openai_key).toBe("o");
    expect(payload.page_context.page_kind).toBe("dashboard");
  });
});
