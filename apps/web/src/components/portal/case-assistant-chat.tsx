"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { 
  X, 
  Bot, 
  Send, 
  Search, 
  Star, 
  Trash2, 
  Clock, 
  RefreshCw 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isStaff } from "@/lib/auth";
import { apiPost, apiGet, apiDelete } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/agent/user-avatar";
import type { User } from "@/types/user";

type ArchivedMessage = {
  id: string;
  session_id: string;
  sender: "user" | "bot";
  sender_name: string;
  body: string;
  category?: string;
  ticket_ref?: string;
  is_bookmarked: boolean;
  created_at: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  body: string;
};

function HelpABotIcon() {
  return (
    <div className="relative size-12 flex items-center justify-center animate-hover-bob">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes hover-bob {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-5px); }
        }
        @keyframes flame-flicker {
          0%, 100% { transform: scaleY(1) scaleX(1); opacity: 0.9; }
          25% { transform: scaleY(1.2) scaleX(0.9); opacity: 1; }
          50% { transform: scaleY(0.85) scaleX(1.1); opacity: 0.8; }
          75% { transform: scaleY(1.1) scaleX(0.95); opacity: 0.95; }
        }
        @keyframes eye-pulse {
          0%, 100% { opacity: 0.85; filter: drop-shadow(0 0 1px #22d3ee); }
          50% { opacity: 1; filter: drop-shadow(0 0 4px #22d3ee); }
        }
        .animate-hover-bob {
          animation: hover-bob 3s ease-in-out infinite;
        }
        .animate-flame {
          animation: flame-flicker 0.15s ease-in-out infinite;
        }
        .animate-eye {
          animation: eye-pulse 2s ease-in-out infinite;
        }
      `}} />
      <svg viewBox="0 0 100 100" className="w-full h-full select-none" aria-hidden="true">
        <defs>
          <radialGradient id="metal-body" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="45%" stopColor="#cbd5e1" />
            <stop offset="85%" stopColor="#475569" />
            <stop offset="100%" stopColor="#1e293b" />
          </radialGradient>
          
          <linearGradient id="metal-dark" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#94a3b8" />
            <stop offset="50%" stopColor="#475569" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>

          <radialGradient id="eye-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#e0f7fa" />
            <stop offset="40%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#0891b2" />
          </radialGradient>

          <linearGradient id="flame-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffedd5" />
            <stop offset="40%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Flame thruster */}
        <g className="animate-flame origin-top">
          <path d="M42 74 Q50 96 58 74 Z" fill="url(#flame-grad)" />
          <path d="M45 74 Q50 88 55 74 Z" fill="#ffffff" opacity="0.8" />
        </g>

        {/* Thruster nozzle */}
        <rect x="43" y="68" width="14" height="6" rx="2" fill="url(#metal-dark)" stroke="#334155" strokeWidth="0.5" />

        {/* Mechanical Arms */}
        {/* Left Arm */}
        <path d="M26 48 Q10 54 14 68 Q17 70 19 63" fill="none" stroke="url(#metal-dark)" strokeWidth="4.5" strokeLinecap="round" />
        <circle cx="14" cy="68" r="3" fill="#cbd5e1" stroke="#334155" strokeWidth="0.5" />
        {/* Right Arm */}
        <path d="M74 48 Q90 54 86 68 Q83 70 81 63" fill="none" stroke="url(#metal-dark)" strokeWidth="4.5" strokeLinecap="round" />
        <circle cx="86" cy="68" r="3" fill="#cbd5e1" stroke="#334155" strokeWidth="0.5" />

        {/* Spherical Main Body */}
        <circle cx="50" cy="42" r="24" fill="url(#metal-body)" stroke="#334155" strokeWidth="1" />

        {/* Body details / plates */}
        <path d="M31 38 Q50 43 69 38" fill="none" stroke="#334155" strokeWidth="1" opacity="0.5" />
        <path d="M33 48 Q50 53 67 48" fill="none" stroke="#334155" strokeWidth="1" opacity="0.5" />

        {/* Optic Sensor Stalks */}
        {/* Left Eye Stalk */}
        <path d="M36 26 Q22 14 24 9" fill="none" stroke="url(#metal-dark)" strokeWidth="4" strokeLinecap="round" />
        {/* Right Eye Stalk */}
        <path d="M64 26 Q78 14 76 9" fill="none" stroke="url(#metal-dark)" strokeWidth="4" strokeLinecap="round" />

        {/* Optic Sensors (Eyes) */}
        {/* Center Eye */}
        <circle cx="50" cy="28" r="7.5" fill="url(#metal-dark)" stroke="#334155" strokeWidth="0.5" />
        <circle cx="50" cy="28" r="4.5" fill="url(#eye-glow)" className="animate-eye" />
        <circle cx="48.5" cy="26.5" r="1.5" fill="#ffffff" opacity="0.8" />

        {/* Left Eye */}
        <circle cx="24" cy="9" r="6.5" fill="url(#metal-dark)" stroke="#334155" strokeWidth="0.5" />
        <circle cx="24" cy="9" r="3.8" fill="url(#eye-glow)" className="animate-eye" />
        <circle cx="22.5" cy="7.5" r="1.2" fill="#ffffff" opacity="0.8" />

        {/* Right Eye */}
        <circle cx="76" cy="9" r="6.5" fill="url(#metal-dark)" stroke="#334155" strokeWidth="0.5" />
        <circle cx="76" cy="9" r="3.8" fill="url(#eye-glow)" className="animate-eye" />
        <circle cx="74.5" cy="7.5" r="1.2" fill="#ffffff" opacity="0.8" />
      </svg>
    </div>
  );
}

export function CaseAssistantChat({ user }: { user: User | null }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const staff = isStaff(user);
  const botName = staff ? "Help-a-bot" : "Sag-assistent";
  const botSub = staff 
    ? "Spørg om systemer, fagsager og procedurer" 
    : "Spørg om dine sager, systemer og vejledninger";
  const fabLabel = staff ? "Help-a-bot" : "Spørg om sager";

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

  const fetchArchive = useCallback(async () => {
    if (!user?.email) return;
    setLoadingArchive(true);
    setArchiveError(null);
    try {
      let url = `/api/v1/chat/messages?user_email=${encodeURIComponent(user.email)}`;
      if (searchQuery) {
        url += `&q=${encodeURIComponent(searchQuery)}`;
      }
      if (filterCategory && filterCategory !== "Alle") {
        url += `&category=${encodeURIComponent(filterCategory)}`;
      }
      if (onlyBookmarked) {
        url += `&only_bookmarked=true`;
      }
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
    if (activeTab === "archive" && open) {
      fetchArchive();
    }
  }, [activeTab, open, fetchArchive]);

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

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm("Er du sikker på, at du vil slette denne samtales historik?")) return;
    try {
      await apiDelete(`/api/v1/chat/sessions/${sessionId}`);
      setArchivedMessages((prev) => prev.filter((msg) => msg.session_id !== sessionId));
    } catch (err) {
      console.error("Error deleting session:", err);
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
    if (open && messages.length === 0) {
      const namePart = useName && user?.display_name ? ` ${user.display_name}` : "";
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          body: staff 
            ? `Hej${namePart}! Jeg er Help-a-bot. Jeg kan hjælpe dig med at søge i vidensartikler, hente sagskategorier eller tjekke sager. Hvad kan jeg gøre for dig?`
            : `Hej${namePart}! Jeg er din personlige Sag-assistent. Spørg mig om dine sager, vores systemer eller vejledninger.`
        }
      ]);
    }
  }, [open, messages.length, staff, useName, user?.display_name]);

  useEffect(() => {
    if (open) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open]);

  const handleSend = useCallback(async () => {
    const trimmed = draft.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: "user",
      body: trimmed
    };

    setMessages((prev) => [...prev, userMsg]);
    setDraft("");
    setLoading(true);

    try {
      // Call our FastAPI backend chat endpoint
      const chatHistory = messages.concat(userMsg).map((m) => ({
        role: m.role,
        content: m.body
      }));

      // Retrieve custom router settings
      const customUrl = typeof window !== "undefined" ? localStorage.getItem("stardesk-chatbot-custom-url") : null;
      const customModel = typeof window !== "undefined" ? localStorage.getItem("stardesk-chatbot-custom-model") : null;
      const customKey = typeof window !== "undefined" ? localStorage.getItem("stardesk-chatbot-custom-key") : null;
      const customHeader = typeof window !== "undefined" ? localStorage.getItem("stardesk-chatbot-custom-header") : null;

      const openaiKey = typeof window !== "undefined" ? localStorage.getItem("stardesk-chatbot-openai-key") : null;
      const anthropicKey = typeof window !== "undefined" ? localStorage.getItem("stardesk-chatbot-anthropic-key") : null;
      const googleKey = typeof window !== "undefined" ? localStorage.getItem("stardesk-chatbot-google-key") : null;

      const res = await apiPost<{ response: string }>("/api/v1/chat", {
        messages: chatHistory,
        user_email: user?.email || null,
        user_name: useName ? (user?.display_name || null) : null,
        model_override: activeModel,
        custom_router_url: customUrl,
        custom_router_key: customKey,
        custom_router_model: customModel,
        custom_router_header_type: customHeader,
        session_id: chatSessionId || null,
        openai_key: openaiKey,
        anthropic_key: anthropicKey,
        google_key: googleKey
      });

      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-assistant`,
          role: "assistant",
          body: res.response
        }
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
  }, [draft, loading, messages, user, useName, activeModel, chatSessionId]);

  return (
    <>
      <button
        type="button"
        className={cn(
          staff
            ? "fixed right-5 bottom-[5.25rem] z-[399] flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold shadow-lg transition-all hover:scale-[1.05] bg-gradient-to-r from-slate-700 to-slate-800 text-slate-100 border border-slate-600 hover:from-slate-600 hover:to-slate-700"
            : cn("case-assistant-fab", open && "case-assistant-fab--open")
        )}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={botName}
      >
        {staff ? (
          <HelpABotIcon />
        ) : (
          <Bot className="size-5 shrink-0" aria-hidden />
        )}
        <span className={cn(!staff && "case-assistant-fab-label", "font-semibold")}>
          {fabLabel}
        </span>
      </button>

      {open ? (
        <div
          className="case-assistant-panel flex flex-col h-[550px] bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
          role="dialog"
          aria-label={botName}
        >
          <header className={cn(
            staff
              ? "bg-gradient-to-r from-slate-800 to-slate-900 relative px-4 py-3.5 pr-10 text-slate-100 border-b border-slate-700"
              : "case-assistant-panel-header"
          )}>
            <div>
              <p className={cn(staff ? "text-sm font-bold tracking-tight text-slate-100" : "case-assistant-panel-title")}>
                {botName}
              </p>
              <p className={cn(staff ? "mt-0.5 text-[11px] text-slate-400" : "case-assistant-panel-sub")}>
                {botSub}
              </p>
            </div>
            <button
              type="button"
              className="case-assistant-panel-close"
              onClick={() => setOpen(false)}
              aria-label="Luk"
            >
              <X className="size-4" />
            </button>
          </header>

          {/* Tabs Selector */}
          <div className="flex border-b border-border bg-slate-50 dark:bg-slate-900 shrink-0">
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
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-950">
                {messages.map((m) => {
                  const isUser = m.role === "user";
                  const showUserAvatar = isUser && useAvatar;
                  const showBotIcon = !isUser && useIcon;
                  return (
                    <div
                      key={m.id}
                      className={cn(
                        "flex items-start gap-2.5",
                        isUser ? "justify-end" : "justify-start"
                      )}
                    >
                      {/* Bot Avatar (Only for Assistant messages) */}
                      {showBotIcon && (
                        <div className="size-8 shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden">
                          {staff ? (
                            <div className="size-10 scale-90 translate-y-0.5">
                              <HelpABotIcon />
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
                  <div className="flex items-start gap-2.5 justify-start">
                    {useIcon && (
                      <div className="size-8 shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden">
                        {staff ? (
                          <div className="size-10 scale-90 translate-y-0.5">
                            <HelpABotIcon />
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
              <footer className="p-3 border-t border-border bg-white dark:bg-slate-900 flex gap-2 items-end">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Skriv din besked her..."
                  rows={1}
                  className="min-h-0 flex-1 resize-none py-2 px-3 text-sm rounded-lg border border-input focus-visible:ring-1 focus-visible:ring-star-blue max-h-24"
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
                  className="bg-star-blue hover:bg-star-navy text-white shrink-0 size-9 rounded-lg"
                  disabled={!draft.trim() || loading}
                  onClick={handleSend}
                  aria-label="Send"
                >
                  <Send className="size-4" />
                </Button>
              </footer>
            </>
          ) : (
            /* Archive & Search View */
            <div className="flex-1 flex flex-col min-h-0 bg-slate-50 dark:bg-slate-950">
              {/* Search and Filters */}
              <div className="p-3 border-b border-border bg-white dark:bg-slate-900 space-y-2 shrink-0">
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
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {loadingArchive ? (
                  <div className="flex flex-col items-center justify-center py-12 text-xs text-muted-foreground gap-2">
                    <RefreshCw className="size-5 animate-spin text-star-blue" />
                    <span>Henter arkiv...</span>
                  </div>
                ) : archiveError ? (
                  <div className="text-center py-12 text-xs text-red-500">{archiveError}</div>
                ) : archivedMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-xs text-muted-foreground text-center px-4">
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
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 shadow-sm hover:shadow-md transition-all space-y-2 relative group"
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
                              onClick={() => handleDeleteSession(msg.session_id)}
                              className="p-1 rounded hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 hover:text-red-500 transition-colors"
                              title="Slet hele samtalen"
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
        </div>
      ) : null}
    </>
  );
}
