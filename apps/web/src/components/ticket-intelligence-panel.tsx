"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { apiGet } from "@/lib/api";
import type { TicketIntelligence, TicketLlmContext } from "@/types/ticket";

export function TicketIntelligencePanel({
  ticketId,
  intelligence,
}: {
  ticketId: string;
  intelligence: TicketIntelligence;
}) {
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  async function copyLlmContext() {
    setCopyStatus(null);
    try {
      const ctx = await apiGet<TicketLlmContext>(
        `/api/v1/tickets/${ticketId}/llm-context`,
      );
      await navigator.clipboard.writeText(JSON.stringify(ctx, null, 2));
      setCopyStatus("Kopieret til udklipsholder");
    } catch {
      setCopyStatus("Kunne ikke kopiere");
    }
  }

  return (
    <Card className="border-star-blue/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Semantik og lethed (LLM)</CardTitle>
        <CardDescription>
          Metadata til AI-vurdering — kilde: {intelligence.source ?? "heuristic"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-2">
          {intelligence.ease_score != null ? (
            <Badge className="bg-star-blue">
              Lethed {intelligence.ease_score}/5 — {intelligence.ease_label_da}
            </Badge>
          ) : null}
          {intelligence.complexity_score != null ? (
            <Badge variant="outline">
              Kompleksitet {intelligence.complexity_score}/5 —{" "}
              {intelligence.complexity_label_da}
            </Badge>
          ) : null}
        </div>
        {(intelligence.semantic_topics?.length ?? 0) > 0 ? (
          <div>
            <p className="text-muted-foreground mb-1 text-xs font-medium uppercase">
              Emner
            </p>
            <div className="flex flex-wrap gap-1">
              {intelligence.semantic_topics.map((topic) => (
                <Badge key={topic} variant="secondary">
                  {topic}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
        {intelligence.llm_summary ? (
          <p>
            <span className="font-medium">Resumé: </span>
            {intelligence.llm_summary}
          </p>
        ) : null}
        {(intelligence.handling_hints?.length ?? 0) > 0 ? (
          <ul className="text-muted-foreground list-inside list-disc space-y-1">
            {intelligence.handling_hints.map((hint) => (
              <li key={hint}>{hint}</li>
            ))}
          </ul>
        ) : null}
        <Button type="button" variant="outline" size="sm" onClick={() => void copyLlmContext()}>
          Kopiér fuld LLM-kontekst (JSON)
        </Button>
        {copyStatus ? (
          <p className="text-muted-foreground text-xs" role="status">
            {copyStatus}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
