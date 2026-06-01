# LLM-vurdering af sager (semantik og lethed)

STARdesk eksponerer struktureret metadata og færdige prompt-tekster, så en **ekstern** LLM (Cursor, OpenAI, Azure OpenAI osv.) kan vurdere sager uden at appen selv kalder LLM-API'er.

## Nøglebegreber

| Felt | Skala | Betydning |
|------|-------|-----------|
| `ease_score` | 1–5 | **Lethed** — hvor let sagen forventes løst (5 = meget let) |
| `complexity_score` | 1–5 | Teknisk/domænemæssig kompleksitet (5 = meget kompleks) |
| `semantic_topics` | ordliste | Normaliserede emner til semantisk match og clustering |
| `llm_summary` | tekst | Kort dansk resumé til prompts |
| `handling_hints` | bullet-liste | Forslag til agent eller LLM |
| `semantic_bundle.combined_text` | tekst | Samlet tekst til embedding eller RAG |

`intelligence_source`: `seed` | `heuristic` | `llm` | `manual`

## API (kræver agent eller admin JWT)

### Enkelt sag

```http
GET /api/v1/tickets/{ticket_id}/llm-context
```

Returnerer `TicketLlmContextRead` med `prompt_snippet_da` og `evaluation_rubric_da`.

### Batch (dispatch-board scope)

```http
GET /api/v1/tickets/llm-eval-pack?board=true&page=1&page_size=50&open_only=true
```

### Opdater efter LLM-vurdering

```http
PATCH /api/v1/tickets/{ticket_id}/intelligence
Content-Type: application/json

{
  "ease_score": 4,
  "complexity_score": 2,
  "semantic_topics": ["printer", "driver"],
  "llm_summary": "Standard printerfejl — geninstallér driver.",
  "handling_hints": ["Send bruger til selvbetjening printer."],
  "source": "llm"
}
```

## Eksempel-prompt til ekstern LLM

```text
Du er STAR ITSM triage-assistent. Brug rubric:

{evaluation_rubric_da}

Vurder følgende sag og returnér JSON med:
- suggested_priority (critical|high|medium|low)
- ease_score (1-5)
- complexity_score (1-5)
- semantic_topics (array, max 8)
- summary_da (max 2 sætninger)
- handling_hints (array, max 4)
- rationale_da (kort begrundelse)

Sag:
{prompt_snippet_da}

Fuld tekst:
{semantic_bundle.combined_text}
```

## Database

Migration: `apps/api/src/star_itsm_api/sql/migrations/08_ticket-intelligence-migration.sql`  
Seed-eksempler: `docs/seed-ticket-intelligence.sql`

Kør via `scripts/run_neon_setup.py` (tilføjet til migrations/seeds).

## Heuristik

Sager uden seed-data får `source: heuristic` ved læsning — scores beregnes fra prioritet, type, længde, tags og nøgleord i titel/beskrivelse.
