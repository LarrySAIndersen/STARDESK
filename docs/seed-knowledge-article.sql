-- Eksempel-vidensartikel (kør efter migration 16)
-- Synlig på selvbetjening for alle autentificerede slutbrugere.

INSERT INTO tickets (
    id,
    ticket_number,
    ticket_type,
    title,
    description,
    status,
    priority,
    reporter_user_id,
    source,
    created_at,
    updated_at,
    is_knowledge_article,
    knowledge_status,
    knowledge_visibility,
    tags
)
SELECT
    gen_random_uuid(),
    'KB-' || to_char(now() AT TIME ZONE 'UTC', 'YYYY') || '-00001',
    'incident',
    'Sådan nulstiller du din adgangskode',
    'Gå til login.star.dk, vælg "Glemt adgangskode", og følg vejledningen. Modtager du ikke mail inden for 15 minutter, kontakt Service Desk.',
    'closed',
    'low',
    u.id,
    'knowledge',
    now(),
    now(),
    TRUE,
    'published',
    'external',
    ARRAY['adgangskode', 'login', 'selvbetjening']::varchar[]
FROM users u
WHERE u.email = 'larrysanders@example.dk'
  AND u.deleted_at IS NULL
LIMIT 1
ON CONFLICT DO NOTHING;
