# ADR 0001: Tag-katalog i database

Status: **Foreslået**

## Kontekst

Fase 1 bruger fil-baseret katalog (`apps/api/src/star_itsm_api/data/tag_catalog_data.py`).
Admin-vedligehold, synonymer på tværs af miljøer og AI-læring kræver persistent katalog.

## Forslag

```sql
CREATE TABLE tag_catalog (
    id UUID PRIMARY KEY,
    slug VARCHAR(64) NOT NULL UNIQUE,
    label_da VARCHAR(128) NOT NULL,
    category VARCHAR(64) NOT NULL,
    keywords TEXT[] NOT NULL DEFAULT '{}',
    synonyms TEXT[] NOT NULL DEFAULT '{}',
    auto_suggest BOOLEAN NOT NULL DEFAULT true,
    description_da TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## Konsekvenser

- Admin CRUD under `/api/v1/admin/tags`
- `tag_catalog.py` læser fra DB med fil-fallback
- Migration via godkendt Alembic/SQL-script

## AI-tags

Eksterne LLM-agenter returnerer `TagSuggestionRead` med `source=llm`; PATCH `/tickets/{id}/intelligence` kan persistere godkendte tags.
