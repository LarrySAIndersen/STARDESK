-- 3 demo-sager per aktiv gruppe (til drag-and-drop oversigt)
-- Kør efter seed-sf-ecosystem-reset.sql (safe to re-run)

DO $$
DECLARE
    team_row RECORD;
    idx INT;
    new_id UUID;
    seq INT := 1;
    reporter UUID;
BEGIN
    IF EXISTS (SELECT 1 FROM tickets WHERE ticket_number LIKE 'DEMO-%' LIMIT 1) THEN
        RETURN;
    END IF;

    SELECT id INTO reporter FROM users WHERE email = 'larrysanders@example.dk' LIMIT 1;
    IF reporter IS NULL THEN
        SELECT id INTO reporter FROM users WHERE role = 'admin' AND deleted_at IS NULL LIMIT 1;
    END IF;

    FOR team_row IN
        SELECT id, name, organization_id FROM teams WHERE is_active ORDER BY name
    LOOP
        FOR idx IN 1..3 LOOP
            new_id := gen_random_uuid();
            INSERT INTO tickets (
                id,
                ticket_number,
                ticket_type,
                title,
                description,
                status,
                priority,
                reporter_user_id,
                assigned_team_id,
                organization_id,
                source,
                gdpr_consent,
                gdpr_consent_at,
                is_major,
                escalation_level,
                created_at,
                updated_at
            ) VALUES (
                new_id,
                'DEMO-' || LPAD(seq::text, 4, '0'),
                'incident',
                team_row.name || ' demo ' || idx,
                'Demosag ' || idx || ' for gruppen ' || team_row.name || '. Bruges til tildelingsoversigt.',
                CASE WHEN idx = 1 THEN 'new' WHEN idx = 2 THEN 'assigned' ELSE 'in_progress' END,
                CASE WHEN idx = 1 THEN 'high' WHEN idx = 2 THEN 'medium' ELSE 'low' END,
                reporter,
                team_row.id,
                team_row.organization_id,
                'portal',
                TRUE,
                NOW(),
                idx = 1,
                0,
                NOW(),
                NOW()
            );
            seq := seq + 1;

            INSERT INTO ticket_events (
                id, ticket_id, actor_user_id, event_type, payload, created_at
            ) VALUES (
                gen_random_uuid(),
                new_id,
                reporter,
                'ticket.created',
                jsonb_build_object('ticket_number', 'DEMO-' || LPAD((seq - 1)::text, 4, '0'), 'seed', true),
                NOW()
            );
        END LOOP;
    END LOOP;
END $$;
