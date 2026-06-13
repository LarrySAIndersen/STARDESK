"use client";

import { fireAndForget } from "@/lib/fire-and-forget";

import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import { Send } from "lucide-react";

import { HelpABotAvatar } from "@/components/portal/help-a-bot-icon";
import { apiPost } from "@/lib/api";
import { isStaff } from "@/lib/auth";
import {
  buildCaseAssistantApiPageContext,
  buildCaseAssistantWelcomeMessages,
  getCaseAssistantQuickActions,
  resolveCaseAssistantPageContext,
  type CaseAssistantQuickAction,
} from "@/lib/case-assistant-page-context";
import {
  buildChatApiPayload,
  createChatMessage,
  getCaseAssistantBotLabels,
  type ChatPanelMessage,
} from "@/lib/case-assistant-chat-panel";
import type { User } from "@/types/user";

function formatInlineBotText(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

function BotBubble({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="home-landing__starbot-bubble">
      <HelpABotAvatar className="home-landing__starbot-avatar size-7 shrink-0" />
      <p className="home-landing__starbot-bubble-text">{children}</p>
    </div>
  );
}

function UserBubble({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="home-landing__starbot-bubble home-landing__starbot-bubble--user">
      <p className="home-landing__starbot-bubble-text home-landing__starbot-bubble-text--user">
        {children}
      </p>
    </div>
  );
}

export function HomeLandingStarbotCard({ user }: Readonly<{ user: User }>) {
  const staff = isStaff(user);
  const { botName } = getCaseAssistantBotLabels(staff);
  const pageContext = useMemo(() => resolveCaseAssistantPageContext("/"), []);
  const apiPageContext = useMemo(
    () => buildCaseAssistantApiPageContext(pageContext),
    [pageContext],
  );

  const welcomeText = useMemo(
    () =>
      buildCaseAssistantWelcomeMessages({
        staff,
        displayName: user.display_name,
        pageContext,
      }).general,
    [staff, user.display_name, pageContext],
  );

  const starbotQuickActions = useMemo(
    () =>
      getCaseAssistantQuickActions({
        staff,
        pageContext,
      }).slice(0, 4),
    [staff, pageContext],
  );

  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<ChatPanelMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [chatSessionId, setChatSessionId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) {
        return;
      }

      const userMsg = createChatMessage("user", trimmed, "-user");
      const historyForApi = [
        createChatMessage("assistant", welcomeText, "-welcome"),
        ...messages,
        userMsg,
      ];

      setMessages((prev) => [...prev, userMsg]);
      setPrompt("");
      setLoading(true);
      setError(null);

      try {
        const customUrl =
          typeof window !== "undefined" ? localStorage.getItem("stardesk-chatbot-custom-url") : null;
        const customModel =
          typeof window !== "undefined" ? localStorage.getItem("stardesk-chatbot-custom-model") : null;
        const customKey =
          typeof window !== "undefined" ? localStorage.getItem("stardesk-chatbot-custom-key") : null;
        const customHeader =
          typeof window !== "undefined" ? localStorage.getItem("stardesk-chatbot-custom-header") : null;
        const openaiKey =
          typeof window !== "undefined" ? localStorage.getItem("stardesk-chatbot-openai-key") : null;
        const anthropicKey =
          typeof window !== "undefined" ? localStorage.getItem("stardesk-chatbot-anthropic-key") : null;
        const googleKey =
          typeof window !== "undefined" ? localStorage.getItem("stardesk-chatbot-google-key") : null;

        const payload = buildChatApiPayload({
          messages: historyForApi,
          userEmail: user.email,
          userDisplayName: user.display_name,
          useName: true,
          activeModel: "gemini-1.5-flash",
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

        const res = await apiPost<{ response: string; session_id?: string }>("/api/v1/chat", payload);

        if (res.session_id) {
          setChatSessionId(res.session_id);
        }

        setMessages((prev) => [
          ...prev,
          createChatMessage("assistant", res.response, "-assistant"),
        ]);
      } catch {
        setError("Kunne ikke hente svar. Prøv igen om lidt.");
      } finally {
        setLoading(false);
      }
    },
    [loading, messages, welcomeText, user, chatSessionId, apiPageContext],
  );

  const handleQuickAction = useCallback(
    (action: CaseAssistantQuickAction) => {
      if (action.autoSend) {
        fireAndForget(sendMessage(action.message));
        return;
      }
      setPrompt(action.message);
    },
    [sendMessage],
  );

  return (
    <section
      className="home-landing__search-card home-landing__search-card--starbot"
      aria-label={`STARbot — ${botName}`}
    >
      <div className="home-landing__starbot-thread" role="log" aria-live="polite">
        <BotBubble>{formatInlineBotText(welcomeText)}</BotBubble>
        {messages.map((message) =>
          message.role === "user" ? (
            <UserBubble key={message.id}>{message.body}</UserBubble>
          ) : (
            <BotBubble key={message.id}>{formatInlineBotText(message.body)}</BotBubble>
          ),
        )}
        {loading ? (
          <BotBubble>
            <span className="home-landing__starbot-thinking">Tænker…</span>
          </BotBubble>
        ) : null}
        {error ? (
          <p className="home-landing__starbot-error" role="alert">{error}</p>
        ) : null}
      </div>

      {starbotQuickActions.length > 0 ? (
        <div className="home-landing__starbot-quick" role="group" aria-label="Hurtige forslag">
          {starbotQuickActions.map((action) => (
            <button
              key={action.label}
              type="button"
              className="home-landing__starbot-quick-btn"
              onClick={() => handleQuickAction(action)}
              disabled={loading}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}

      <form
        className="home-landing__search-row home-landing__starbot-form"
        onSubmit={(event) => {
          event.preventDefault();
          fireAndForget(sendMessage(prompt));
        }}
      >
        <input
          type="text"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Skriv dit spørgsmål her…"
          className="home-landing__search-input"
          aria-label={`Spørg ${botName}`}
          disabled={loading}
        />
        <button
          type="submit"
          className="home-landing__starbot-send"
          disabled={!prompt.trim() || loading}
          aria-label="Send til Help-a-bot"
        >
          <Send className="size-4" aria-hidden />
        </button>
      </form>
    </section>
  );
}
