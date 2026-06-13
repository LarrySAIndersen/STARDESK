"use client";

import { fireAndForget } from "@/lib/fire-and-forget";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { 
  X, 
  Bot, 
  Send, 
  Search, 
  Star, 
  Trash2, 
  Clock, 
  RefreshCw,
  Mic,
  MicOff,
  Maximize2,
  Minimize2,
  GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  buildCaseAssistantApiPageContext,
  buildCaseAssistantWelcomeMessages,
  getCaseAssistantQuickActions,
  resolveCaseAssistantPageContext,
  type CaseAssistantQuickAction,
} from "@/lib/case-assistant-page-context";
import { isStaff } from "@/lib/auth";
import { apiPost, apiGet, apiDelete } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/agent/user-avatar";
import { HelpABotAvatarPicker } from "@/components/portal/help-a-bot-avatar-picker";
import {
  HelpABotAvatar,
  HELP_A_BOT_AVATAR_STORAGE_KEY,
  isValidHelpABotAvatarId,
  type HelpABotAvatarId,
} from "@/components/portal/help-a-bot-icon";
import {
  buildChatApiPayload,
  buildChatArchiveUrl,
  clampPanelSize,
  createChatMessage,
  getCaseAssistantBotLabels,
  getDefaultPanelPosition,
  MOCK_SPEECH_SAMPLE,
  PANEL_POS_STORAGE_KEY,
  PANEL_SIZE_PRESETS,
  PANEL_SIZE_STORAGE_KEY,
  parseStoredPanelSize,
  parseStoredPoint,
  resolvePanelSizeForPreset,
  type PanelSizePreset,
} from "@/lib/case-assistant-chat-panel";
import {
  CASE_ASSISTANT_OPEN_EVENT,
  CASE_ASSISTANT_TOGGLE_EVENT,
  dispatchCaseAssistantState,
  type CaseAssistantOpenDetail,
} from "@/lib/case-assistant-open";
import type { User } from "@/types/user";
import type { TicketDetail } from "@/types/ticket";

type ArchivedMessage = Readonly<{
  id: string;
  session_id: string;
  sender: "user" | "bot";
  sender_name: string;
  body: string;
  category?: string;
  ticket_ref?: string;
  is_bookmarked: boolean;
  created_at: string;
}>;

type ChatMessage = Readonly<{
  id: string;
  role: "user" | "assistant";
  body: string;
}>;

function buildWelcomeChatMessages(options: {
  staff: boolean;
  displayName?: string | null;
  pageContext: ReturnType<typeof resolveCaseAssistantPageContext>;
  ticket?: Pick<TicketDetail, "ticket_number" | "title"> | null;
}): ChatMessage[] {
  const { general, pageSpecific } = buildCaseAssistantWelcomeMessages({
    staff: options.staff,
    displayName: options.displayName,
    pageContext: options.pageContext,
    ticket: options.ticket,
  });
  return [
    { id: "welcome-general", role: "assistant", body: general },
    { id: "welcome-page", role: "assistant", body: pageSpecific },
  ];
}

function isOnlyWelcomeMessages(messages: ChatMessage[]): boolean {
  return (
    messages.length > 0 &&
    messages.length <= 2 &&
    messages.every(
      (message) =>
        message.role === "assistant" &&
        (message.id === "welcome-general" ||
          message.id === "welcome-page" ||
          message.id === "welcome"),
    )
  );
}

export function CaseAssistantChat({
  user,
  pathname = "/",
}: {
  user: User | null;
  pathname?: string;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const draftInputRef = useRef<HTMLTextAreaElement>(null);

  const staff = isStaff(user);
  const pageContext = resolveCaseAssistantPageContext(pathname);
  const [pageTicket, setPageTicket] = useState<TicketDetail | null>(null);
  const contextualQuickActions = useMemo(
    () =>
      getCaseAssistantQuickActions({
        staff,
        pageContext,
        ticket: pageTicket,
      }),
    [staff, pageContext, pageTicket],
  );
  const apiPageContext = useMemo(
    () => buildCaseAssistantApiPageContext(pageContext, pageTicket),
    [pageContext, pageTicket],
  );
  const { botName, botSub, fabLabel } = getCaseAssistantBotLabels(staff);

  const [useName, setUseName] = useState(true);
  const [useAvatar, setUseAvatar] = useState(true);
  const [useIcon, setUseIcon] = useState(true);
  const [activeModel, setActiveModel] = useState("gemini-1.5-flash");
  const [chatSessionId, setChatSessionId] = useState("");

  // Archive & Search States
  const [activeTab, setActiveTab] = useState<"chat" | "archive">("chat");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("Alle");
  const [onlyBookmarked, setOnlyBookmarked] = useState(false);
  const [archivedMessages, setArchivedMessages] = useState<ArchivedMessage[]>([]);
  const [loadingArchive, setLoadingArchive] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const [panelPreset, setPanelPreset] = useState<PanelSizePreset>("normal");
  const [panelSize, setPanelSize] = useState(() => PANEL_SIZE_PRESETS.normal);
  const [panelPos, setPanelPos] = useState<{ x: number; y: number } | null>(null);
  const [pendingAutoSend, setPendingAutoSend] = useState<string | null>(null);
  const [selectedAvatarId, setSelectedAvatarId] = useState<HelpABotAvatarId>("robot");
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const dragStateRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const resizeStateRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);

  const fetchArchive = useCallback(async () => {
    if (!user?.email) return;
    setLoadingArchive(true);
    setArchiveError(null);
    try {
      const url = buildChatArchiveUrl({
        userEmail: user.email,
        searchQuery,
        filterCategory,
        onlyBookmarked,
      });
      const data = await apiGet<ArchivedMessage[]>(url);
      setArchivedMessages(data);
    } catch (err) {
      console.error("Error fetching chatbot message archive:", err);
      setArchiveError("Kunne ikke hente besked-arkiv. Prøv igen.");
    } finally {
      setLoadingArchive(false);
    }
  }, [user?.email, searchQuery, filterCategory, onlyBookmarked]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const storedPos = parseStoredPoint(localStorage.getItem(PANEL_POS_STORAGE_KEY));
      const storedAvatar = localStorage.getItem(HELP_A_BOT_AVATAR_STORAGE_KEY);
      const storedSize = parseStoredPanelSize(localStorage.getItem(PANEL_SIZE_STORAGE_KEY));
      if (storedPos) {
        setPanelPos(storedPos);
      }
      if (storedAvatar && isValidHelpABotAvatarId(storedAvatar)) {
        setSelectedAvatarId(storedAvatar);
      }
      if (storedSize) {
        setPanelPreset(storedSize.preset);
        setPanelSize({ width: storedSize.width, height: storedSize.height });
      }
    } catch {
      // ignore corrupt storage
    }
  }, []);

  useEffect(() => {
    function handleExternalOpen(event: Event) {
      const detail = (event as CustomEvent<CaseAssistantOpenDetail>).detail ?? {};
      setOpen(true);
      setActiveTab("chat");
      const trimmedDraft = detail.draft?.trim();
      if (trimmedDraft) {
        setDraft(trimmedDraft);
      }
      if (detail.autoSend && trimmedDraft) {
        setPendingAutoSend(trimmedDraft);
      } else if (detail.focusInput) {
        window.setTimeout(() => draftInputRef.current?.focus(), 60);
      }
    }

    window.addEventListener(CASE_ASSISTANT_OPEN_EVENT, handleExternalOpen);
    return () => window.removeEventListener(CASE_ASSISTANT_OPEN_EVENT, handleExternalOpen);
  }, []);

  useEffect(() => {
    function handleToggle() {
      setOpen((prev) => !prev);
    }

    window.addEventListener(CASE_ASSISTANT_TOGGLE_EVENT, handleToggle);
    return () => window.removeEventListener(CASE_ASSISTANT_TOGGLE_EVENT, handleToggle);
  }, []);

  useEffect(() => {
    dispatchCaseAssistantState(open);
  }, [open]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(
      PANEL_SIZE_STORAGE_KEY,
      JSON.stringify({ preset: panelPreset, width: panelSize.width, height: panelSize.height }),
    );
  }, [panelPreset, panelSize]);

  useEffect(() => {
    if (typeof window === "undefined" || !panelPos) return;
    localStorage.setItem(PANEL_POS_STORAGE_KEY, JSON.stringify(panelPos));
  }, [panelPos]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(HELP_A_BOT_AVATAR_STORAGE_KEY, selectedAvatarId);
  }, [selectedAvatarId]);

  const applyPreset = useCallback((preset: PanelSizePreset) => {
    setPanelPreset(preset);
    setPanelSize(resolvePanelSizeForPreset(preset));
  }, []);

  const resolvedPanelPos =
    panelPos ?? getDefaultPanelPosition(panelSize.width, panelSize.height);

  const handleAvatarDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAvatarPickerOpen(true);
  }, []);

  const handlePanelDragStart = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const origin =
        panelPos ?? getDefaultPanelPosition(panelSize.width, panelSize.height);
      dragStateRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        originX: origin.x,
        originY: origin.y,
      };

      function onMove(ev: MouseEvent) {
        const drag = dragStateRef.current;
        if (!drag) return;
        const nextX = drag.originX + (ev.clientX - drag.startX);
        const nextY = drag.originY + (ev.clientY - drag.startY);
        const maxX = Math.max(0, window.innerWidth - panelSize.width);
        const maxY = Math.max(0, window.innerHeight - panelSize.height);
        setPanelPos({
          x: Math.min(Math.max(0, nextX), maxX),
          y: Math.min(Math.max(0, nextY), maxY),
        });
      }

      function onUp() {
        dragStateRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      }

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [panelPos, panelSize.height, panelSize.width],
  );

  const handlePanelResizeStart = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();
      resizeStateRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startW: panelSize.width,
        startH: panelSize.height,
      };

      function onMove(ev: MouseEvent) {
        const resize = resizeStateRef.current;
        if (!resize) return;
        const next = clampPanelSize(
          resize.startW + (ev.clientX - resize.startX),
          resize.startH + (ev.clientY - resize.startY),
        );
        setPanelSize(next);
        setPanelPreset("normal");
      }

      function onUp() {
        resizeStateRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      }

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [panelSize.height, panelSize.width],
  );

  const handleToggleSpeech = useCallback(() => {
    if (loading) return;

    const SpeechRecognitionCtor =
      typeof window !== "undefined"
        ? window.SpeechRecognition ?? window.webkitSpeechRecognition
        : undefined;

    if (!SpeechRecognitionCtor) {
      setDraft((prev) =>
        prev.trim()
          ? `${prev.trim()} ${MOCK_SPEECH_SAMPLE}`
          : `Tale til tekst: ${MOCK_SPEECH_SAMPLE}`,
      );
      return;
    }

    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "da-DK";
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        transcript += event.results[i]?.[0]?.transcript ?? "";
      }
      const trimmed = transcript.trim();
      if (trimmed) {
        setDraft((prev) => (prev.trim() ? `${prev.trim()} ${trimmed}` : trimmed));
      }
    };
    recognition.onerror = () => {
      setListening(false);
    };
    recognition.onend = () => {
      setListening(false);
    };

    setListening(true);
    recognition.start();
  }, [listening, loading]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const handleToggleBookmark = async (id: string) => {
    try {
      await apiPost(`/api/v1/chat/messages/${id}/bookmark`, {});
      setArchivedMessages((prev) =>
        prev.map((msg) =>
          msg.id === id ? { ...msg, is_bookmarked: !msg.is_bookmarked } : msg
        )
      );
    } catch (err) {
      console.error("Error toggling bookmark:", err);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm("Slet denne ene besked fra historikken?")) return;
    try {
      await apiDelete(`/api/v1/chat/messages/${messageId}`);
      setArchivedMessages((prev) => prev.filter((msg) => msg.id !== messageId));
    } catch (err) {
      console.error("Error deleting message:", err);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      setUseName(localStorage.getItem("stardesk-chatbot-use-name") !== "false");
      setUseAvatar(localStorage.getItem("stardesk-chatbot-use-avatar") !== "false");
      setUseIcon(localStorage.getItem("stardesk-chatbot-use-icon") !== "false");
      setActiveModel(localStorage.getItem("stardesk-chatbot-model") || "gemini-1.5-flash");
    }
    if (open && !chatSessionId) {
      if (typeof window !== "undefined" && typeof window.crypto?.randomUUID === "function") {
        setChatSessionId(window.crypto.randomUUID());
      } else {
        // Fallback using crypto.getRandomValues if randomUUID is not available
        const arr = new Uint8Array(16);
        if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
          window.crypto.getRandomValues(arr);
        }
        arr[6] = (arr[6] & 0x0f) | 0x40; // version 4
        arr[8] = (arr[8] & 0x3f) | 0x80; // variant RFC4122
        const hex = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
        const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
        setChatSessionId(uuid);
      }
    }
  }, [open, chatSessionId]);

  useEffect(() => {
    if (activeTab === "archive" && open) {
      fetchArchive();
    }
  }, [activeTab, open, fetchArchive]);

  useEffect(() => {
    if (!pageContext.ticketId) {
      setPageTicket(null);
      return;
    }

    let cancelled = false;
    apiGet<TicketDetail>(`/api/v1/tickets/${pageContext.ticketId}`)
      .then((ticket) => {
        if (!cancelled) {
          setPageTicket(ticket);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPageTicket(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pageContext.ticketId]);

  useEffect(() => {
    setMessages([]);
    setChatSessionId("");
    setDraft("");
  }, [pageContext.contextKey]);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages(
        buildWelcomeChatMessages({
          staff,
          displayName: useName ? user?.display_name : null,
          pageContext,
          ticket: pageTicket,
        }),
      );
    }
  }, [open, messages.length, staff, useName, user?.display_name, pageContext, pageTicket]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setMessages((prev) => {
      if (!isOnlyWelcomeMessages(prev)) {
        return prev;
      }
      return buildWelcomeChatMessages({
        staff,
        displayName: useName ? user?.display_name : null,
        pageContext,
        ticket: pageTicket,
      });
    });
  }, [open, pageTicket, pageContext, staff, useName, user?.display_name]);

  useEffect(() => {
    if (open) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open]);

  const handleSend = useCallback(async (messageOverride?: string) => {
    const trimmed = (messageOverride ?? draft).trim();
    if (!trimmed || loading) return;

    const userMsg = createChatMessage("user", trimmed, "-user");

    setMessages((prev) => [...prev, userMsg]);
    if (!messageOverride) {
      setDraft("");
    }
    setLoading(true);

    try {
      const customUrl = typeof window !== "undefined" ? localStorage.getItem("stardesk-chatbot-custom-url") : null;
      const customModel = typeof window !== "undefined" ? localStorage.getItem("stardesk-chatbot-custom-model") : null;
      const customKey = typeof window !== "undefined" ? localStorage.getItem("stardesk-chatbot-custom-key") : null;
      const customHeader = typeof window !== "undefined" ? localStorage.getItem("stardesk-chatbot-custom-header") : null;

      const openaiKey = typeof window !== "undefined" ? localStorage.getItem("stardesk-chatbot-openai-key") : null;
      const anthropicKey = typeof window !== "undefined" ? localStorage.getItem("stardesk-chatbot-anthropic-key") : null;
      const googleKey = typeof window !== "undefined" ? localStorage.getItem("stardesk-chatbot-google-key") : null;

      const payload = buildChatApiPayload({
        messages: messages.concat(userMsg),
        userEmail: user?.email,
        userDisplayName: user?.display_name,
        useName,
        activeModel,
        chatSessionId,
        pageContext: apiPageContext,
        customRouter: {
          url: customUrl,
          key: customKey,
          model: customModel,
          headerType: customHeader,
        },
        providerKeys: {
          openai: openaiKey,
          anthropic: anthropicKey,
          google: googleKey,
        },
      });

      const res = await apiPost<{ response: string }>("/api/v1/chat", payload);

      setMessages((prev) => [
        ...prev,
        createChatMessage("assistant", res.response, "-assistant"),
      ]);
    } catch (err) {
      console.error("Chat error:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-error`,
          role: "assistant",
          body: "Der opstod desværre en fejl under kommunikationen med sprogmodellen. Prøv igen om lidt."
        }
      ]);
    } finally {
      setLoading(false);
    }
  }, [draft, loading, messages, user, useName, activeModel, chatSessionId, apiPageContext]);

  useEffect(() => {
    if (!open || !pendingAutoSend || loading) {
      return;
    }
    const message = pendingAutoSend;
    setPendingAutoSend(null);
    fireAndForget(handleSend(message));
  }, [open, pendingAutoSend, loading, handleSend]);

  const handleQuickAction = useCallback(
    (action: CaseAssistantQuickAction) => {
      if (action.autoSend) {
        fireAndForget(handleSend(action.message));
        return;
      }
      setDraft(action.message);
    },
    [handleSend],
  );

  return (
    <>
      {!staff ? (
        <button
          ref={fabRef}
          type="button"
          className={cn("case-assistant-fab", open && "case-assistant-fab--open")}
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label={botName}
        >
          <Bot className="size-5 shrink-0" aria-hidden />
          <span className={cn("case-assistant-fab-label", "font-semibold")}>{fabLabel}</span>
        </button>
      ) : null}

      {staff ? (
        <HelpABotAvatarPicker
          open={avatarPickerOpen}
          selectedId={selectedAvatarId}
          onSelect={setSelectedAvatarId}
          onClose={() => setAvatarPickerOpen(false)}
        />
      ) : null}

      {open ? (
        <div
          ref={panelRef}
          className="case-assistant-panel case-assistant-panel--floating flex flex-col overflow-hidden"
          style={{
            left: resolvedPanelPos.x,
            top: resolvedPanelPos.y,
            width: panelSize.width,
            height: panelSize.height,
          }}
          role="dialog"
          aria-modal={false}
          aria-label={botName}
        >
          <header
            className={cn(
              "case-assistant-panel--interactive",
              staff
                ? "bg-gradient-to-r from-slate-800 to-slate-900 relative px-3 py-2.5 pr-24 text-slate-100 border-b border-slate-700 case-assistant-panel-drag-handle shrink-0"
                : "case-assistant-panel-header case-assistant-panel-drag-handle shrink-0",
            )}
            onMouseDown={handlePanelDragStart}
          >
            <div className="flex items-center gap-2 min-w-0">
              <GripVertical className={cn("size-4 shrink-0 opacity-50", staff ? "text-slate-400" : "text-white/60")} aria-hidden />
              {staff && useIcon ? (
                <div
                  className="size-9 shrink-0 -my-1 cursor-pointer"
                  aria-hidden="true"
                  onDoubleClick={handleAvatarDoubleClick}
                  title="Dobbeltklik for at vælge avatar"
                >
                  <HelpABotAvatar avatarId={selectedAvatarId} className="size-9" />
                </div>
              ) : null}
              <div className="min-w-0">
                <p className={cn(staff ? "text-sm font-bold tracking-tight text-slate-100" : "case-assistant-panel-title")}>
                  {botName}
                </p>
                <p className={cn(staff ? "mt-0.5 text-[11px] text-slate-400" : "case-assistant-panel-sub")}>
                  {botSub}
                </p>
              </div>
            </div>
            <div className="absolute top-2 right-2 flex items-center gap-0.5">
              <button
                type="button"
                className={cn(
                  "rounded p-1 transition-colors",
                  staff ? "text-slate-300 hover:bg-white/10 hover:text-white" : "text-white/80 hover:bg-white/10 hover:text-white",
                )}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => applyPreset(panelPreset === "expanded" ? "compact" : "expanded")}
                aria-label={panelPreset === "expanded" ? "Gør vinduet mindre" : "Udvid vinduet"}
                title={panelPreset === "expanded" ? "Gør mindre" : "Udvid"}
              >
                {panelPreset === "expanded" ? (
                  <Minimize2 className="size-3.5" />
                ) : (
                  <Maximize2 className="size-3.5" />
                )}
              </button>
              <button
                type="button"
                className="case-assistant-panel-close static"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => setOpen(false)}
                aria-label="Luk"
              >
                <X className="size-4" />
              </button>
            </div>
          </header>

          {/* Tabs Selector */}
          <div className="case-assistant-panel--interactive flex shrink-0 border-b border-border bg-slate-50 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setActiveTab("chat")}
              className={cn(
                "flex-1 py-2 text-xs font-semibold border-b-2 text-center transition-all",
                activeTab === "chat"
                  ? "border-star-blue text-star-blue bg-white dark:bg-slate-950"
                  : "border-transparent text-muted-foreground hover:text-slate-800 dark:hover:text-slate-200"
              )}
            >
              Aktiv Chat
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("archive")}
              className={cn(
                "flex-1 py-2 text-xs font-semibold border-b-2 text-center transition-all",
                activeTab === "archive"
                  ? "border-star-blue text-star-blue bg-white dark:bg-slate-950"
                  : "border-transparent text-muted-foreground hover:text-slate-800 dark:hover:text-slate-200"
              )}
            >
              Historik & Bogmærker
            </button>
          </div>

          {activeTab === "chat" ? (
            <>
              {/* Chat messages list */}
              <div className="pointer-events-none flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-950">
                {messages.map((m) => {
                  const isUser = m.role === "user";
                  const showUserAvatar = isUser && useAvatar;
                  const showBotIcon = !isUser && useIcon;
                  return (
                    <div
                      key={m.id}
                      className={cn(
                        "case-assistant-panel--interactive flex items-start gap-2.5",
                        isUser ? "justify-end" : "justify-start"
                      )}
                    >
                      {/* Bot Avatar (Only for Assistant messages) */}
                      {showBotIcon && (
                        <div className="size-8 shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden">
                          {staff ? (
                            <div className="size-10 scale-90 translate-y-0.5">
                              <HelpABotAvatar avatarId={selectedAvatarId} />
                            </div>
                          ) : (
                            <Bot className="size-4 text-star-navy dark:text-star-blue" />
                          )}
                        </div>
                      )}

                      {/* Message Bubble */}
                      <div
                        className={cn(
                          "flex flex-col max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-sm",
                          isUser
                            ? "bg-star-blue text-white rounded-br-none"
                            : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-bl-none text-slate-800 dark:text-slate-100"
                        )}
                      >
                        <div className="whitespace-pre-wrap leading-relaxed">{m.body}</div>
                      </div>

                      {/* User Avatar (Only for User messages) */}
                      {showUserAvatar && (
                        <div className="size-8 shrink-0 rounded-full flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-800">
                          <UserAvatar user={user} size="sm" className="size-8 text-[10px]" />
                        </div>
                      )}
                    </div>
                  );
                })}
                
                {loading && (
                  <div className="case-assistant-panel--interactive flex items-start gap-2.5 justify-start">
                    {useIcon && (
                      <div className="size-8 shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden">
                        {staff ? (
                          <div className="size-10 scale-90 translate-y-0.5">
                            <HelpABotAvatar avatarId={selectedAvatarId} />
                          </div>
                        ) : (
                          <Bot className="size-4 text-star-navy dark:text-star-blue" />
                        )}
                      </div>
                    )}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl rounded-bl-none px-4 py-3 text-sm shadow-sm flex items-center gap-1.5 text-slate-500">
                      <span className="size-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="size-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="size-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                )}
                <div ref={endRef} />
              </div>

              {/* Input footer */}
              <footer className="case-assistant-panel--interactive shrink-0 border-t border-border bg-white p-3 dark:bg-slate-900">
                {activeTab === "chat" && contextualQuickActions.length > 0 ? (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {contextualQuickActions.map((action) => (
                      <button
                        key={action.label}
                        type="button"
                        className="rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1 text-[10px] font-medium text-slate-600 dark:text-slate-300 transition-colors hover:border-star-blue hover:bg-star-blue-light hover:text-star-navy"
                        onClick={() => handleQuickAction(action)}
                        disabled={loading}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="flex gap-2 items-end">
                  <Textarea
                    ref={draftInputRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={listening ? "Lytter… tal nu" : "Fx mine sager · INC-2026-00118 · luk INC-… · opret Titel - Beskrivelse"}
                    rows={panelPreset === "expanded" ? 2 : 1}
                    className={cn(
                      "min-h-0 flex-1 resize-none py-2 px-3 text-sm rounded-lg border border-input focus-visible:ring-1 focus-visible:ring-star-blue",
                      panelPreset === "expanded" ? "max-h-32" : "max-h-24",
                      listening && "border-star-blue ring-1 ring-star-blue/40",
                    )}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className={cn(
                      "shrink-0 size-9 rounded-lg",
                      listening && "border-star-blue bg-star-blue-light text-star-navy",
                    )}
                    disabled={loading}
                    onClick={handleToggleSpeech}
                    aria-label={listening ? "Stop tale til tekst" : "Start tale til tekst"}
                    title={listening ? "Stop optagelse" : "Tal ind"}
                  >
                    {listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    className="bg-star-blue hover:bg-star-navy text-white shrink-0 size-9 rounded-lg"
                    disabled={!draft.trim() || loading}
                    onClick={() => fireAndForget(handleSend())}
                    aria-label="Send"
                  >
                    <Send className="size-4" />
                  </Button>
                </div>
              </footer>
            </>
          ) : (
            /* Archive & Search View */
            <div className="pointer-events-none flex min-h-0 flex-1 flex-col bg-slate-50 dark:bg-slate-950">
              {/* Search and Filters */}
              <div className="case-assistant-panel--interactive shrink-0 space-y-2 border-b border-border bg-white p-3 dark:bg-slate-900">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Søg i gemte beskeder..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 h-8 text-xs rounded border border-input bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-star-blue"
                  />
                </div>
                
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-semibold text-slate-500">Kategori:</span>
                    <select
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                      className="h-7 rounded border border-input px-1.5 text-[11px] bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
                    >
                      <option value="Alle">Alle</option>
                      <option value="Generelt">Generelt</option>
                      <option value="VPN">VPN</option>
                      <option value="MitID">MitID</option>
                      <option value="SLA">SLA</option>
                      <option value="Adgangskode">Adgangskode</option>
                    </select>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => setOnlyBookmarked(!onlyBookmarked)}
                    className={cn(
                      "flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-all border",
                      onlyBookmarked
                        ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 font-medium"
                        : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    )}
                  >
                    <Star className={cn("size-3", onlyBookmarked ? "fill-amber-500 text-amber-500" : "")} />
                    Bogmærker
                  </button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={fetchArchive}
                    disabled={loadingArchive}
                    className="h-7 text-[10px] px-2 flex items-center gap-1 text-star-blue"
                  >
                    <RefreshCw className={cn("size-3", loadingArchive && "animate-spin")} />
                    Opdater
                  </Button>
                </div>
              </div>

              {/* Archived messages list */}
              <div className="pointer-events-none flex-1 overflow-y-auto p-3 space-y-3">
                {loadingArchive ? (
                  <div className="case-assistant-panel--interactive flex flex-col items-center justify-center gap-2 py-12 text-xs text-muted-foreground">
                    <RefreshCw className="size-5 animate-spin text-star-blue" />
                    <span>Henter arkiv...</span>
                  </div>
                ) : archiveError ? (
                  <div className="case-assistant-panel--interactive py-12 text-center text-xs text-red-500">{archiveError}</div>
                ) : archivedMessages.length === 0 ? (
                  <div className="case-assistant-panel--interactive flex flex-col items-center justify-center px-4 py-12 text-center text-xs text-muted-foreground">
                    <Clock className="size-8 text-slate-300 dark:text-slate-700 mb-2" />
                    <p className="font-semibold text-slate-600 dark:text-slate-400">Ingen beskeder fundet</p>
                    <p className="text-[10px] mt-1">Stil spørgsmål til chatbotten for automatisk at opbygge historikken.</p>
                  </div>
                ) : (
                  archivedMessages.map((msg) => {
                    const isStarred = msg.is_bookmarked;
                    const isBot = msg.sender === "bot";
                    
                    return (
                      <div 
                        key={msg.id} 
                        className="case-assistant-panel--interactive relative space-y-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-all group hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                      >
                        <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-1.5 text-[10px]">
                          <div className="flex items-center gap-1.5 font-bold">
                            <span className={cn(
                              "size-2 rounded-full",
                              isBot ? "bg-emerald-500" : "bg-star-blue"
                            )} />
                            <span className="text-slate-700 dark:text-slate-300">{msg.sender_name}</span>
                            {msg.category && (
                              <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded text-[9px] font-normal">
                                {msg.category}
                              </span>
                            )}
                            {msg.ticket_ref && (
                              <span className="bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded text-[9px] font-bold">
                                {msg.ticket_ref}
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-1 text-slate-400 dark:text-slate-600 opacity-80 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => handleToggleBookmark(msg.id)}
                              className={cn(
                                "p-1 rounded hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors",
                                isStarred ? "text-amber-500" : "text-slate-400 hover:text-amber-500"
                              )}
                              title={isStarred ? "Fjern bogmærke" : "Tilføj bogmærke"}
                            >
                              <Star className={cn("size-3.5", isStarred ? "fill-amber-500" : "")} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDraft(msg.body);
                                setActiveTab("chat");
                              }}
                              className="p-1 rounded hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-400 hover:text-star-blue dark:hover:text-star-blue transition-colors text-[9px] font-bold px-1.5"
                              title="Genbrug denne besked i chatten"
                            >
                              Genbrug
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteMessage(msg.id)}
                              className="p-1 rounded hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 hover:text-red-500 transition-colors"
                              title="Slet denne besked"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                          {msg.body}
                        </div>
                        
                        <div className="text-[9px] text-muted-foreground text-right">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(msg.created_at).toLocaleDateString([], { day: 'numeric', month: 'short' })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
          <div
            className="case-assistant-panel-resize-handle case-assistant-panel--interactive"
            role="separator"
            aria-label="Træk for at ændre størrelse"
            onMouseDown={handlePanelResizeStart}
          />
        </div>
      ) : null}
    </>
  );
}
