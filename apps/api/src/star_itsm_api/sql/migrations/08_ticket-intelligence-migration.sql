-- Semantic + ease metadata for LLM-assisted triage (no embeddings required)
ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS semantic_topics TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS ease_score SMALLINT
        CHECK (ease_score IS NULL OR ease_score BETWEEN 1 AND 5),
    ADD COLUMN IF NOT EXISTS complexity_score SMALLINT
        CHECK (complexity_score IS NULL OR complexity_score BETWEEN 1 AND 5),
    ADD COLUMN IF NOT EXISTS llm_summary TEXT,
    ADD COLUMN IF NOT EXISTS handling_hints TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS intelligence_source VARCHAR(32)
        CHECK (
            intelligence_source IS NULL
            OR intelligence_source IN ('seed', 'heuristic', 'llm', 'manual')
        ),
    ADD COLUMN IF NOT EXISTS intelligence_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tickets_semantic_topics_gin
    ON tickets USING GIN (semantic_topics);

CREATE INDEX IF NOT EXISTS idx_tickets_ease_score
    ON tickets (ease_score)
    WHERE deleted_at IS NULL AND ease_score IS NOT NULL;

COMMENT ON COLUMN tickets.ease_score IS '1=svær, 5=let at løse (lethed)';
COMMENT ON COLUMN tickets.complexity_score IS '1=simpel, 5=kompleks sag';
COMMENT ON COLUMN tickets.llm_summary IS 'Kort dansk sammenfatning til LLM-prompts';
COMMENT ON COLUMN tickets.semantic_topics IS 'Normaliserede emneord til semantisk match';
