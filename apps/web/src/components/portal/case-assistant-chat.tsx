"use client";

import { Bot, Send, X } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  CASE_ASSISTANT_SUGGESTIONS,
  mockCaseAssistantReply,
  type CaseAssistantLink,
  type CaseAssistantReply,
} from "@/lib/mock-case-assistant";
import { MOCK_ASSET_SYSTEMS } from "@/lib/mock-assets";
import { apiGet } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { AssetSystem } from "@/types/asset";
import type { Ticket } from "@/types/ticket";
import type { User } from "@/types/user";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  body: string;
  links?: CaseAssistantLink[];
};

function renderBody(body: string): ReactNode {
  const parts = body.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-star-navy">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part.split("\n").map((line, j, arr) => (
      <span key={`${i}-${j}`}>
        {line}
        {j < arr.length - 1 ? <br /> : null}
      </span>
    ));
  });
}

function nextId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function CaseAssistantChat({ user }: { user: User | null }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [systems, setSystems] = useState<AssetSystem[]>(MOCK_ASSET_SYSTEMS);
  const [ready, setReady] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const loadContext = useCallback(async () => {
    const [ticketResult, assetResult] = await Promise.allSettled([
      apiGet<Ticket[]>("/api/v1/tickets"),
      apiGet<AssetSystem[]>("/api/v1/assets"),
    ]);
    if (ticketResult.status === "fulfilled") {
      setTickets(ticketResult.value);
    }
    if (assetResult.status === "fulfilled" && assetResult.value.length > 0) {
      setSystems(assetResult.value);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!open || ready) return;
    void loadContext();
  }, [open, ready, loadContext]);

  useEffect(() => {
    if (open) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open]);

  const pushAssistant = useCallback((reply: CaseAssistantReply) => {
    setMessages((prev) => [
      ...prev,
      {
        id: nextId(),
        role: "assistant",
        body: reply.body,
        links: reply.links,
      },
    ]);
  }, []);

  const sendText = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: "user", body: trimmed },
      ]);
      const reply = mockCaseAssistantReply(trimmed, {
        tickets,
        systems,
        userDisplayName: user?.display_name ?? user?.email,
      });
      pushAssistant(reply);
      setDraft("");
    },
    [tickets, systems, user, pushAssistant],
  );

  const handleOpen = useCallback(async () => {
    setOpen(true);
    let ctxTickets = tickets;
    let ctxSystems = systems;
    if (!ready) {
      const [ticketResult, assetResult] = await Promise.allSettled([
        apiGet<Ticket[]>("/api/v1/tickets"),
        apiGet<AssetSystem[]>("/api/v1/assets"),
      ]);
      if (ticketResult.status === "fulfilled") {
        ctxTickets = ticketResult.value;
        setTickets(ctxTickets);
      }
      if (assetResult.status === "fulfilled" && assetResult.value.length > 0) {
        ctxSystems = assetResult.value;
        setSystems(ctxSystems);
      }
      setReady(true);
    }
    setMessages((prev) => {
      if (prev.length > 0) return prev;
      const reply = mockCaseAssistantReply("hjælp", {
        tickets: ctxTickets,
        systems: ctxSystems,
        userDisplayName: user?.display_name ?? user?.email,
      });
      return [
        {
          id: nextId(),
          role: "assistant",
          body: reply.body,
          links: reply.links,
        },
      ];
    });
  }, [ready, tickets, systems, user]);

  return (
    <>
      <button
        type="button"
        className={cn("case-assistant-fab", open && "case-assistant-fab--open")}
        onClick={() => {
          if (open) setOpen(false);
          else void handleOpen();
        }}
        aria-expanded={open}
        aria-label="Sag-assistent"
      >
        <Bot className="size-5 shrink-0" aria-hidden />
        <span className="case-assistant-fab-label">Spørg om sager</span>
      </button>

      {open ? (
        <div
          className="case-assistant-panel"
          role="dialog"
          aria-label="Sag-assistent mock chatbot"
        >
          <header className="case-assistant-panel-header">
            <div>
              <p className="case-assistant-panel-title">Sag-assistent</p>
              <p className="case-assistant-panel-sub">
                Mock — spørg om dine sager og systemer
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

          <div className="case-assistant-panel-body">
            <div className="sf-chat-messages">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "sf-chat-bubble",
                    m.role === "user" ? "sf-chat-bubble--own" : "sf-chat-bubble--agent",
                  )}
                >
                  {m.role === "assistant" ? (
                    <span className="sf-chat-bubble-name">Assistent</span>
                  ) : null}
                  <div>{renderBody(m.body)}</div>
                  {m.links && m.links.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.links.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          className="text-star-blue text-[11px] font-semibold underline hover:text-star-navy"
                          onClick={() => setOpen(false)}
                        >
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
              <div ref={endRef} />
            </div>
          </div>

          <div className="case-assistant-suggestions">
            {CASE_ASSISTANT_SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                className="case-assistant-chip"
                onClick={() => sendText(s)}
              >
                {s}
              </button>
            ))}
          </div>

          <footer className="case-assistant-panel-footer">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Fx «vis mine sager» eller «sag DEMO-2026-0001»"
              rows={2}
              className="min-h-0 flex-1 resize-none text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendText(draft);
                }
              }}
            />
            <Button
              type="button"
              size="icon"
              className="sf-chat-send shrink-0"
              disabled={!draft.trim()}
              onClick={() => sendText(draft)}
              aria-label="Send"
            >
              <Send className="size-4" />
            </Button>
          </footer>
        </div>
      ) : null}
    </>
  );
}
