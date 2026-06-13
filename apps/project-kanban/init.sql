-- Project Kanban — separat database (kør i eget Neon-projekt)
-- Uafhængig af STARdesk schema

CREATE TABLE IF NOT EXISTS pk_columns (
    id UUID PRIMARY KEY,
    name VARCHAR(64) NOT NULL,
    position SMALLINT NOT NULL
);

CREATE TABLE IF NOT EXISTS pk_cards (
    id UUID PRIMARY KEY,
    column_id UUID NOT NULL REFERENCES pk_columns(id) ON DELETE CASCADE,
    title VARCHAR(512) NOT NULL,
    description TEXT,
    position SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pk_cards_column ON pk_cards (column_id, position);

-- Standard-kolonner (spring over hvis der allerede findes kolonner)
INSERT INTO pk_columns (id, name, position)
SELECT * FROM (VALUES
    ('a1000000-0000-4000-8000-000000000001'::uuid, 'Backlog', 0),
    ('a1000000-0000-4000-8000-000000000002'::uuid, 'I gang', 1),
    ('a1000000-0000-4000-8000-000000000003'::uuid, 'Review', 2),
    ('a1000000-0000-4000-8000-000000000004'::uuid, 'Done', 3)
) AS v(id, name, position)
WHERE NOT EXISTS (SELECT 1 FROM pk_columns LIMIT 1);

-- Seed fra STARDESK/Background/Backlog (kun hvis boardet er tomt)
INSERT INTO pk_cards (id, column_id, title, position)
SELECT * FROM (VALUES
    ('b1000000-0000-4000-8000-000000000001'::uuid, 'a1000000-0000-4000-8000-000000000001'::uuid, 'Asset-site med ITIL server-side standard klasser', 0),
    ('b1000000-0000-4000-8000-000000000002'::uuid, 'a1000000-0000-4000-8000-000000000001'::uuid, 'Slack integration', 1),
    ('b1000000-0000-4000-8000-000000000003'::uuid, 'a1000000-0000-4000-8000-000000000001'::uuid, 'Test system + restore kontrol + patch-behov', 2),
    ('b1000000-0000-4000-8000-000000000004'::uuid, 'a1000000-0000-4000-8000-000000000001'::uuid, 'Keycloak + indmelding approve + auto-opret via AI', 3),
    ('b1000000-0000-4000-8000-000000000005'::uuid, 'a1000000-0000-4000-8000-000000000001'::uuid, 'Sager i Slack-kanal via hook (pull/opdater)', 4),
    ('b1000000-0000-4000-8000-000000000006'::uuid, 'a1000000-0000-4000-8000-000000000001'::uuid, 'Hover på sager med indhold', 5),
    ('b1000000-0000-4000-8000-000000000007'::uuid, 'a1000000-0000-4000-8000-000000000001'::uuid, 'Mentions i Slack fra sager', 6),
    ('b1000000-0000-4000-8000-000000000008'::uuid, 'a1000000-0000-4000-8000-000000000001'::uuid, 'Vælg store sag blandt uløste', 7),
    ('b1000000-0000-4000-8000-000000000009'::uuid, 'a1000000-0000-4000-8000-000000000001'::uuid, 'Brugeradministrationsside', 8),
    ('b1000000-0000-4000-8000-000000000010'::uuid, 'a1000000-0000-4000-8000-000000000001'::uuid, 'Restore af DB og system med configs', 9),
    ('b1000000-0000-4000-8000-000000000011'::uuid, 'a1000000-0000-4000-8000-000000000001'::uuid, 'Tydelig markering ved stor sag', 10),
    ('b1000000-0000-4000-8000-000000000012'::uuid, 'a1000000-0000-4000-8000-000000000001'::uuid, 'Ekstern integration (push frem/tilbage)', 11),
    ('b1000000-0000-4000-8000-000000000013'::uuid, 'a1000000-0000-4000-8000-000000000001'::uuid, 'Kontrol af CPR-opdateringsfelter', 12),
    ('b1000000-0000-4000-8000-000000000014'::uuid, 'a1000000-0000-4000-8000-000000000001'::uuid, 'Sager med visuelt overlay', 13),
    ('b1000000-0000-4000-8000-000000000015'::uuid, 'a1000000-0000-4000-8000-000000000001'::uuid, 'Password kompleksitet', 14),
    ('b1000000-0000-4000-8000-000000000016'::uuid, 'a1000000-0000-4000-8000-000000000001'::uuid, 'Sager flyttes/gemmes på modtager-gruppe', 15),
    ('b1000000-0000-4000-8000-000000000017'::uuid, 'a1000000-0000-4000-8000-000000000001'::uuid, 'Business rules + golden store verificering', 16),
    ('b1000000-0000-4000-8000-000000000018'::uuid, 'a1000000-0000-4000-8000-000000000001'::uuid, 'Keycloak tjek (Claude)', 17),
    ('b1000000-0000-4000-8000-000000000019'::uuid, 'a1000000-0000-4000-8000-000000000001'::uuid, 'Fuld Sentry + Playwright flows', 18),
    ('b1000000-0000-4000-8000-000000000020'::uuid, 'a1000000-0000-4000-8000-000000000004'::uuid, 'Billeder gemmes/uploades/vises på sager', 0)
) AS v(id, column_id, title, position)
WHERE NOT EXISTS (SELECT 1 FROM pk_cards LIMIT 1);
