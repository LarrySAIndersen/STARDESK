export type ChatApiPageContext = {
  page_path: string;
  page_label: string;
  page_kind: string;
  ticket_id?: string | null;
  ticket_number?: string | null;
  ticket_title?: string | null;
};

export type PanelSizePreset = "compact" | "normal" | "expanded";

export const PANEL_SIZE_PRESETS: Record<PanelSizePreset, { width: number; height: number }> = {
  compact: { width: 340, height: 420 },
  normal: { width: 400, height: 550 },
  expanded: { width: 620, height: 720 },
};

export const PANEL_POS_STORAGE_KEY = "stardesk-helpabot-pos";
export const PANEL_SIZE_STORAGE_KEY = "stardesk-helpabot-size";
export const FAB_POS_STORAGE_KEY = "stardesk-helpabot-fab-pos";
export const MOCK_SPEECH_SAMPLE = "Jeg har brug for hjælp til at opdatere en sag";

export function clampPanelSize(width: number, height: number) {
  if (typeof window === "undefined") {
    return { width, height };
  }
  return {
    width: Math.min(Math.max(width, 300), Math.floor(window.innerWidth * 0.92)),
    height: Math.min(Math.max(height, 360), Math.floor(window.innerHeight * 0.88)),
  };
}

export function getExpandedHeight() {
  if (typeof window === "undefined") {
    return PANEL_SIZE_PRESETS.expanded.height;
  }
  return Math.min(PANEL_SIZE_PRESETS.expanded.height, Math.floor(window.innerHeight * 0.85));
}

export function getCaseAssistantBotLabels(staff: boolean) {
  return {
    botName: staff ? "Help-a-bot" : "Sag-assistent",
    botSub: staff
      ? "Spørg om systemer, fagsager og procedurer"
      : "Spørg om dine sager, systemer og vejledninger",
    fabLabel: staff ? "Help-a-bot" : "Spørg om sager",
  };
}

export function buildChatArchiveUrl(options: {
  userEmail: string;
  searchQuery?: string;
  filterCategory?: string;
  onlyBookmarked?: boolean;
}): string {
  let url = `/api/v1/chat/messages?user_email=${encodeURIComponent(options.userEmail)}`;
  if (options.searchQuery) {
    url += `&q=${encodeURIComponent(options.searchQuery)}`;
  }
  if (options.filterCategory && options.filterCategory !== "Alle") {
    url += `&category=${encodeURIComponent(options.filterCategory)}`;
  }
  if (options.onlyBookmarked) {
    url += "&only_bookmarked=true";
  }
  return url;
}

export function parseStoredPoint(raw: string | null): { x: number; y: number } | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { x?: number; y?: number };
    if (typeof parsed.x === "number" && typeof parsed.y === "number") {
      return { x: parsed.x, y: parsed.y };
    }
  } catch {
    return null;
  }
  return null;
}

export type StoredPanelSize = {
  preset: PanelSizePreset;
  width: number;
  height: number;
};

export function parseStoredPanelSize(raw: string | null): StoredPanelSize | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      preset?: PanelSizePreset;
      width?: number;
      height?: number;
    };
    if (!parsed.preset || !PANEL_SIZE_PRESETS[parsed.preset]) {
      return null;
    }
    const preset = parsed.preset;
    const base = PANEL_SIZE_PRESETS[preset];
    const height = preset === "expanded" ? getExpandedHeight() : base.height;
    const size = clampPanelSize(parsed.width ?? base.width, parsed.height ?? height);
    return { preset, width: size.width, height: size.height };
  } catch {
    return null;
  }
}

export function resolvePanelSizeForPreset(preset: PanelSizePreset): { width: number; height: number } {
  const base = PANEL_SIZE_PRESETS[preset];
  const height = preset === "expanded" ? getExpandedHeight() : base.height;
  return clampPanelSize(base.width, height);
}

export function getDefaultPanelPosition(panelWidth: number, panelHeight: number) {
  if (typeof window === "undefined") {
    return { x: 20, y: 80 };
  }
  return {
    x: Math.max(16, window.innerWidth - panelWidth - 20),
    y: Math.max(16, window.innerHeight - panelHeight - 84),
  };
}

export function getDefaultFabPosition(fabWidth: number, fabHeight: number) {
  if (typeof window === "undefined") {
    return { x: 20, y: 500 };
  }
  return {
    x: Math.max(16, window.innerWidth - fabWidth - 20),
    y: Math.max(16, window.innerHeight - fabHeight - 84),
  };
}

export function clampFabPosition(
  x: number,
  y: number,
  fabWidth: number,
  fabHeight: number,
): { x: number; y: number } {
  if (typeof window === "undefined") {
    return { x, y };
  }
  const maxX = Math.max(0, window.innerWidth - fabWidth);
  const maxY = Math.max(0, window.innerHeight - fabHeight);
  return {
    x: Math.min(maxX, Math.max(0, x)),
    y: Math.min(maxY, Math.max(0, y)),
  };
}

export type ChatPanelMessage = Readonly<{
  id: string;
  role: "user" | "assistant";
  body: string;
}>;

export function buildChatApiPayload(options: {
  messages: ChatPanelMessage[];
  userEmail?: string | null;
  userDisplayName?: string | null;
  useName: boolean;
  activeModel: string;
  chatSessionId: string;
  pageContext: ChatApiPageContext;
  customRouter?: {
    url?: string | null;
    key?: string | null;
    model?: string | null;
    headerType?: string | null;
  };
  providerKeys?: {
    openai?: string | null;
    anthropic?: string | null;
    google?: string | null;
  };
}) {
  return {
    messages: options.messages.map((m) => ({
      role: m.role,
      content: m.body,
    })),
    user_email: options.userEmail || null,
    user_name: options.useName ? options.userDisplayName || null : null,
    model_override: options.activeModel,
    custom_router_url: options.customRouter?.url ?? null,
    custom_router_key: options.customRouter?.key ?? null,
    custom_router_model: options.customRouter?.model ?? null,
    custom_router_header_type: options.customRouter?.headerType ?? null,
    session_id: options.chatSessionId || null,
    openai_key: options.providerKeys?.openai ?? null,
    anthropic_key: options.providerKeys?.anthropic ?? null,
    google_key: options.providerKeys?.google ?? null,
    page_context: options.pageContext,
  };
}

export function createChatMessage(role: "user" | "assistant", body: string, suffix = ""): ChatPanelMessage {
  return {
    id: `msg-${Date.now()}${suffix}`,
    role,
    body,
  };
}
