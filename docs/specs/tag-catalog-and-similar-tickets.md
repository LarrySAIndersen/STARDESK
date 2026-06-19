# Tag-katalog og lignende sager

Status: **Implementeret (fase 1)** — fil-baseret katalog, klar til AI-tags.

## Formål

- Fælles **tag-katalog** så sager kan genfindes konsistent
- **Foreslå tags** fra tekst (regler + katalog-keywords i dag; LLM senere)
- **Lignende sager** baseret på tags, semantiske emner og tekst

## API

| Endpoint | Beskrivelse |
|----------|-------------|
| `GET /api/v1/tags` | Katalog med valgfri `usage_count` |
| `GET /api/v1/tags/suggest?text=` | Tag-forslag med `confidence` og `source` |
| `GET /api/v1/tags/validate?tags=` | Kendte vs. ukendte slugs |
| `GET /api/v1/tickets?tags=vpn,printer` | Eksakt tag-filter (`tags_match=any\|all`) |
| `GET /api/v1/tickets/{id}/similar` | Rangordnede lignende sager |

## AI-udvidelse (forberedt)

- `TagSuggestionRead.source`: `catalog_keyword` \| `catalog_rule` \| **`llm`** \| `manual`
- Intake-assist returnerer `tag_suggestions[]` ud over `tags[]`
- Ekstern LLM kan POST/PATCH intelligence og returnere `source=llm` via samme schema
- Fremtidig DB-tabel `tag_catalog` — se `docs/adr/0001-tag-catalog-database.md`

## Tests

- `apps/api/tests/test_tag_catalog.py`
- `apps/api/tests/test_ticket_classification.py` (søgefilter)
- `apps/api/tests/test_ticket_intake_assist.py`

## UI

- `ticket-tags-emoji-fields.tsx` — autocomplete fra katalog
- `ticket-similar-panel.tsx` — lignende sager på sagsdetalje (staff)
- `ticket-create-llm-assistant.tsx` — viser foreslåede tags
