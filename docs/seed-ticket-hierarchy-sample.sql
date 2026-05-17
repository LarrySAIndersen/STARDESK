-- Sample store sag + små sager (run after ticket-hierarchy-migration.sql and demo tickets)
-- Safe to re-run: skips when DEMO-HIER-0001 exists

DO $$
DECLARE
    store_id UUID;
    reporter UUID;
BEGIN
    IF EXISTS (SELECT 1 FROM tickets WHERE ticket_number = 'DEMO-HIER-0001') THEN
        RETURN;
    END IF;

    SELECT id INTO reporter FROM users WHERE role = 'admin' AND deleted_at IS NULL LIMIT 1;
    IF reporter IS NULL THEN
        RETURN;
    END IF;

    store_id := gen_random_uuid();
    INSERT INTO tickets (
        id, ticket_number, ticket_type, title, description,
        status, priority, reporter_user_id, source,
        gdpr_consent, gdpr_consent_at, is_major, escalation_level,
        created_at, updated_at
    ) VALUES (
        store_id,
        'DEMO-HIER-0001',
        'incident',
        'Demo store sag — netværksnedbrud',
        'Overordnet hændelse med flere underliggende sager.',
        'in_progress',
        'high',
        reporter,
        'portal',
        TRUE,
        NOW(),
        TRUE,
        0,
        NOW(),
        NOW()
    );

    INSERT INTO tickets (
        id, ticket_number, ticket_type, title, description,
        status, priority, reporter_user_id, source,
        gdpr_consent, gdpr_consent_at, is_major, parent_ticket_id,
        escalation_level, created_at, updated_at
    ) VALUES
    (
        gen_random_uuid(),
        'DEMO-HIER-0002',
        'incident',
        'Små sag — kontor A offline',
        'Underordnet sag til store sag DEMO-HIER-0001.',
        'assigned',
        'medium',
        reporter,
        'portal',
        TRUE,
        NOW(),
        FALSE,
        store_id,
        0,
        NOW(),
        NOW()
    ),
    (
        gen_random_uuid(),
        'DEMO-HIER-0003',
        'incident',
        'Små sag — VPN fejl',
        'Anden underordnet sag.',
        'new',
        'medium',
        reporter,
        'portal',
        TRUE,
        NOW(),
        FALSE,
        store_id,
        0,
        NOW(),
        NOW()
    );
END $$;
