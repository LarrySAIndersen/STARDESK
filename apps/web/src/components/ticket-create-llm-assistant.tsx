"use client";

import { fireAndForget } from "@/lib/fire-and-forget";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { IntakeAnswers } from "@/components/ticket-intake-questions";
import { apiPost } from "@/lib/api";
import { cn } from "@/lib/utils";

export type IntakeAssistDraft = {
  title: string;
  description: string;
  intake_answers: IntakeAnswers;
  suggested_priority: "critical" | "high" | "medium" | "low";
  suggested_ticket_type: "service_request" | "incident" | "problem";
  tags: string[];
  emoji: string | null;
};

type ChatMessage = Readonly<{
  id: string;
  role: "user" | "assistant";
  content: string;
}>;

const MOCK_SPEECH_SAMPLE =
  "Jeg kan ikke logge ind på VPN fra hjemmefra — det skete efter weekenden.";

const PRIORITY_LABELS: Record<IntakeAssistDraft["suggested_priority"], string> = {
  critical: "Kritisk",
  high: "Høj",
  medium: "Medium",
  low: "Lav",
};

const TYPE_LABELS: Record<IntakeAssistDraft["suggested_ticket_type"], string> = {
  incident: "Hændelse",
  service_request: "Serviceanmodning",
  problem: "Problem",
};

function mockReplyLocally(userText: string): string {
  const lower = userText.toLowerCase();
  if (/\bvpn\b|hjemmefra|fjern/.test(lower)) {
    return "Det lyder som VPN/fjernarbejde — jeg udarbejder et forslag med netværkstags.";
  }
  if (/\bprinter|print/.test(lower)) {
    return "Printerproblem noteret. Jeg foreslår enhedstype printer i udkastet.";
  }
  if (/\blogin|logge|adgangskode|password|kodeord/.test(lower)) {
    return "Login/adgang — jeg foreslår høj prioritet i udkastet.";
  }
  if (/\bmail|outlook/.test(lower)) {
    return "E-mail/Outlook — jeg samler et udkast med mail-tags.";
  }
  if (/\bmøde|akut|haster|deadline/.test(lower)) {
    return "Haster det — jeg markerer urgency og høj prioritet.";
  }
  return (
    "Tak for beskrivelsen. Gennemgå forslaget nedenfor — brug «Overfør til sag» efter godkendelse."
  );
}

async function fetchDraftFromApi(messages: ChatMessage[]): Promise<IntakeAssistDraft> {
  const payload = {
    messages: messages
      .filter((m) => m.id !== "welcome")
      .map((m) => ({ role: m.role, content: m.content })),
  };
  return apiPost<IntakeAssistDraft>("/api/v1/tickets/intake-assist", payload);
}

function newId(): string {
  if (typeof window !== "undefined" && typeof window.crypto?.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  const arr = new Uint32Array(1);
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(arr);
  } else {
    arr[0] = Date.now();
  }
  return `${Date.now()}-${arr[0].toString(36)}`;
}

export function TicketCreateLlmAssistant({
  onApplyDraft,
  disabled = false,
  embedded = false,
}: {
  onApplyDraft: (draft: IntakeAssistDraft) => void;
  disabled?: boolean;
  /** When true, omit outer heading/banner (used inside collapsible section). */
  embedded?: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hej! Beskriv dit problem med tekst eller «Tal ind». Når du er klar, gennemgår du mit forslag og overfører det til sagen efter godkendelse.",
    },
  ]);
  const [input, setInput] = useState("");
  const [draft, setDraft] = useState<IntakeAssistDraft | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const scrollChat = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollChat();
  }, [messages, draft, scrollChat]);

  const regenerateDraft = useCallback(
    async (history: ChatMessage[]) => {
      const userMsgs = history.filter((m) => m.role === "user");
      if (userMsgs.length === 0) {
        setDraft(null);
        return;
      }
      setDraftLoading(true);
      setDraftError(null);
      try {
        const next = await fetchDraftFromApi(history);
        setDraft(next);
      } catch {
        const blob = userMsgs.map((m) => m.content).join("\n");
        setDraft({
          title: blob.slice(0, 80) || "IT-support henvendelse",
          description: `**Mock (offline)**\n\n${blob}`,
          intake_answers: {},
          suggested_priority: "medium",
          suggested_ticket_type: "incident",
          tags: ["generel"],
          emoji: "💬",
        });
        setDraftError("API utilgængelig — viser lokalt mock-udkast.");
      } finally {
        setDraftLoading(false);
      }
    },
    [],
  );

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || disabled) {
      return;
    }
    const userMsg: ChatMessage = { id: newId(), role: "user", content: text };
    const assistantMsg: ChatMessage = {
      id: newId(),
      role: "assistant",
      content: mockReplyLocally(text),
    };
    const nextHistory = [...messages, userMsg, assistantMsg];
    setMessages(nextHistory);
    setInput("");
    await regenerateDraft(nextHistory);
  }, [disabled, input, messages, regenerateDraft]);

  function handleDiscard() {
    setDraft(null);
    setDraftError(null);
  }

  function handleTransfer() {
    if (!draft) {
      return;
    }
    onApplyDraft(draft);
    setDraft(null);
    setDraftError(null);
    setMessages((prev) => [
      ...prev,
      {
        id: newId(),
        role: "assistant",
        content: "Udkastet er overført til formularen. Ret felterne efter behov og opret sagen.",
      },
    ]);
  }

  function handleSpeak() {
    if (disabled) {
      return;
    }
    const SpeechRecognitionCtor =
      typeof window !== "undefined"
        ? window.SpeechRecognition ?? window.webkitSpeechRecognition
        : undefined;

    if (!SpeechRecognitionCtor) {
      setInput((prev) =>
        prev.trim()
          ? `${prev.trim()} ${MOCK_SPEECH_SAMPLE}`
          : `Mock: tale til tekst — ${MOCK_SPEECH_SAMPLE}`,
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
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) {
        setInput((prev) => (prev.trim() ? `${prev.trim()} ${transcript}` : transcript));
      }
    };
    recognition.onerror = () => {
      setListening(false);
      setInput((prev) =>
        prev.trim()
          ? `${prev.trim()} ${MOCK_SPEECH_SAMPLE}`
          : `Mock: tale til tekst — ${MOCK_SPEECH_SAMPLE}`,
      );
    };
    recognition.onend = () => {
      setListening(false);
    };

    setListening(true);
    recognition.start();
  }

  return (
    <aside
      className="ticket-create-llm-panel"
      aria-labelledby={embedded ? undefined : "ticket-create-llm-heading"}
    >
      {embedded ? null : (
        <>
          <div className="wire-ai-banner mb-4" role="note">
            <span className="wire-ai-pill">Prototype</span>
            <p className="wire-ai-text m-0">
              AI-assistent (mock) — ingen rigtig LLM. Svar og udkast er regelbaserede; API:{" "}
              <code className="text-[10px]">POST /api/v1/tickets/intake-assist</code>
            </p>
          </div>

          <h2 id="ticket-create-llm-heading" className="wire-card-title mb-1">
            AI-assistent (mock)
          </h2>
          <p className="text-muted-foreground mb-3 text-xs">
            Skriv eller tal — valider forslaget, overfør til sagen efter godkendelse.
          </p>
        </>
      )}

      <div
        className="ticket-create-llm-chat mb-3"
        aria-live="polite"
        aria-label="Samtale med assistent"
      >
        <ul className="space-y-2">
          {messages.map((msg) => (
            <li
              key={msg.id}
              className={cn(
                "rounded-[2px] px-2.5 py-2 text-xs leading-relaxed",
                msg.role === "user"
                  ? "ml-6 border border-[var(--gray-border)] bg-white text-[var(--gray-text)]"
                  : "mr-4 border border-[#6b6fd4]/30 bg-[var(--ai-purple-bg)] text-[#2a2c7a]",
              )}
            >
              <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide opacity-70">
                {msg.role === "user" ? "Du" : "Assistent"}
              </span>
              {msg.content}
            </li>
          ))}
        </ul>
        <div ref={chatEndRef} />
      </div>

      <div className="space-y-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              fireAndForget(sendMessage());
            }
          }}
          rows={3}
          disabled={disabled}
          placeholder="Beskriv problemet…"
          className="wire-form-input min-h-[4.5rem] resize-y text-sm"
          aria-label="Besked til AI-assistent"
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="wire-btn wire-btn-primary h-8 px-3 text-xs"
            disabled={disabled || !input.trim()}
            onClick={() => fireAndForget(sendMessage())}
          >
            Send
          </Button>
          <Button
            type="button"
            variant="outline"
            className="wire-btn h-8 px-3 text-xs"
            disabled={disabled}
            onClick={handleSpeak}
          >
            {listening ? "Stop optagelse" : "Tal ind"}
          </Button>
        </div>
      </div>

      {draftLoading ? (
        <p className="text-muted-foreground mt-4 text-xs">Genererer udkast…</p>
      ) : null}

      {draftError ? (
        <p className="mt-2 text-xs text-amber-700" role="status">
          {draftError}
        </p>
      ) : null}

      {draft && !draftLoading ? (
        <section
          className="ticket-create-llm-draft mt-4 space-y-3"
          aria-labelledby="ticket-create-llm-draft-heading"
        >
          <h3 id="ticket-create-llm-draft-heading" className="text-sm font-semibold text-star-navy">
            Foreslået udkast — godkend før overførsel
          </h3>
          <dl className="space-y-2 text-xs">
            <div>
              <dt className="font-semibold text-[var(--gray-mid)]">Foreslået titel</dt>
              <dd className="mt-0.5 text-sm text-star-navy">{draft.title}</dd>
            </div>
            <div>
              <dt className="font-semibold text-[var(--gray-mid)]">Foreslået beskrivelse</dt>
              <dd className="mt-0.5 max-h-28 overflow-y-auto whitespace-pre-wrap rounded-[2px] border border-[var(--gray-border)] bg-white p-2 text-sm">
                {draft.description}
              </dd>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <dt className="font-semibold text-[var(--gray-mid)]">Type (hint)</dt>
                <dd>{TYPE_LABELS[draft.suggested_ticket_type]}</dd>
              </div>
              <div>
                <dt className="font-semibold text-[var(--gray-mid)]">Prioritet (hint)</dt>
                <dd>{PRIORITY_LABELS[draft.suggested_priority]}</dd>
              </div>
            </div>
            {draft.tags.length > 0 ? (
              <div>
                <dt className="font-semibold text-[var(--gray-mid)]">Foreslåede tags</dt>
                <dd className="mt-1 flex flex-wrap gap-1">
                  {draft.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-[2px] border border-[var(--gray-border)] bg-[var(--gray-bg)] px-1.5 py-0.5 text-[10px]"
                    >
                      {tag}
                    </span>
                  ))}
                </dd>
              </div>
            ) : null}
            {draft.emoji ? (
              <div>
                <dt className="font-semibold text-[var(--gray-mid)]">Emoji</dt>
                <dd className="text-lg">{draft.emoji}</dd>
              </div>
            ) : null}
            {Object.keys(draft.intake_answers).length > 0 ? (
              <div>
                <dt className="font-semibold text-[var(--gray-mid)]">Hurtige afklaringer (forslag)</dt>
                <dd className="mt-1 space-y-0.5 font-mono text-[10px]">
                  {Object.entries(draft.intake_answers).map(([k, v]) => (
                    <div key={k}>
                      {k}: {v}
                    </div>
                  ))}
                </dd>
              </div>
            ) : null}
          </dl>
          <div className="flex flex-wrap gap-2 border-t border-[var(--gray-border)] pt-3">
            <Button
              type="button"
              className="wire-btn wire-btn-primary h-8 px-3 text-xs"
              disabled={disabled}
              onClick={handleTransfer}
            >
              Overfør til sag
            </Button>
            <Button
              type="button"
              variant="outline"
              className="wire-btn h-8 px-3 text-xs"
              disabled={disabled}
              onClick={() => fireAndForget(regenerateDraft(messages))}
            >
              Generer igen
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-8 px-3 text-xs text-[var(--gray-mid)]"
              disabled={disabled}
              onClick={handleDiscard}
            >
              Forkast
            </Button>
          </div>
        </section>
      ) : null}
    </aside>
  );
}
