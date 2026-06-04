-- Demo-sager til selvbetjeningsportal: Landsportalen, Jobnet, DFDG og cores-aftagere.
-- Kør efter seed-larrysanders.sql (idempotent via ticket_number).

DO $$
DECLARE
    reporter UUID;
    landssupport UUID;
    schultz_team UUID;
    sf_org UUID;
    cloud_cat UUID;
    integration_sub UUID;
BEGIN
    SELECT id INTO reporter FROM users WHERE email = 'larrysanders@example.dk' AND deleted_at IS NULL LIMIT 1;
    IF reporter IS NULL THEN
        RAISE NOTICE 'seed-portal-landsportal-tickets: larrysanders not found — skipped';
        RETURN;
    END IF;

    SELECT id INTO landssupport FROM teams WHERE name = 'Landssupport' LIMIT 1;
    SELECT id INTO schultz_team FROM teams WHERE name = 'Schultz' LIMIT 1;
    IF schultz_team IS NULL THEN
        schultz_team := landssupport;
    END IF;
    SELECT id INTO sf_org FROM organizations WHERE name = 'SF Operations' LIMIT 1;
    SELECT id INTO cloud_cat FROM categories WHERE name = 'cloud_services' LIMIT 1;
    SELECT id INTO integration_sub FROM subcategories
        WHERE category_id = cloud_cat AND name = 'integration' LIMIT 1;

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
        category_id,
        subcategory_id,
        source,
        tags,
        gdpr_consent,
        gdpr_consent_at,
        is_major,
        escalation_level,
        created_at,
        updated_at
    )
    SELECT * FROM (VALUES
        (
            'c3000001-0000-4000-8000-000000000001'::uuid,
            'LP-2026-00001',
            'incident',
            'Jobnet — langsom svartid ved CV-opdatering',
            'Borgere oplever 45–90 sekunders ventetid når CV gemmes på jobnet.dk. Fejlen ses især i peak mellem 09–11.',
            'assigned',
            'high',
            reporter,
            landssupport,
            sf_org,
            cloud_cat,
            integration_sub,
            'portal',
            ARRAY['landsportalen', 'jobnet', 'svartid', 'cv']::varchar[],
            TRUE,
            NOW(),
            FALSE,
            0,
            NOW() - interval '2 days',
            NOW() - interval '6 hours'
        ),
        (
            'c3000001-0000-4000-8000-000000000002'::uuid,
            'LP-2026-00002',
            'incident',
            'DFDG — borgerdata synkroniseres ikke til STAR',
            'Datadeling fra DFDG returnerer HTTP 504 efter 120 sek. Ca. 12 % af opslag fejler siden i går kl. 14.',
            'in_progress',
            'critical',
            reporter,
            landssupport,
            sf_org,
            cloud_cat,
            integration_sub,
            'phone',
            ARRAY['landsportalen', 'dfdg', 'integration', 'timeout']::varchar[],
            TRUE,
            NOW(),
            FALSE,
            0,
            NOW() - interval '1 day',
            NOW() - interval '2 hours'
        ),
        (
            'c3000001-0000-4000-8000-000000000003'::uuid,
            'LP-2026-00003',
            'incident',
            'Schultz — langsom API på sagsopslag',
            'Cores-aftager Schultz svarer med gns. 18 sek. på GET /cases (SLA: 3 sek). Påvirker jobcenter-sagsbehandling.',
            'new',
            'high',
            reporter,
            schultz_team,
            sf_org,
            cloud_cat,
            integration_sub,
            'portal',
            ARRAY['schultz', 'cores', 'svartid', 'api']::varchar[],
            TRUE,
            NOW(),
            FALSE,
            0,
            NOW() - interval '5 hours',
            NOW() - interval '5 hours'
        ),
        (
            'c3000001-0000-4000-8000-000000000004'::uuid,
            'LP-2026-00004',
            'incident',
            'Jobnet — tilmelding som ledig timeout',
            'MitID-login lykkes, men tilmelding som ledig hænger på "Behandler…" i 2+ min. Indmeldt fra flere jobcentre.',
            'assigned',
            'medium',
            reporter,
            landssupport,
            sf_org,
            cloud_cat,
            integration_sub,
            'phone',
            ARRAY['landsportalen', 'jobnet', 'ledig', 'mitid']::varchar[],
            TRUE,
            NOW(),
            FALSE,
            0,
            NOW() - interval '3 days',
            NOW() - interval '1 day'
        ),
        (
            'c3000001-0000-4000-8000-000000000005'::uuid,
            'LP-2026-00005',
            'incident',
            'Netcompany — ekstern integration afviser kald',
            'STAR modtager 503 Service Unavailable fra Netcompany endpoint ved afsendelse af aktiveringsplan.',
            'new',
            'high',
            reporter,
            landssupport,
            sf_org,
            cloud_cat,
            integration_sub,
            'portal',
            ARRAY['netcompany', 'cores', 'leverandør', 'integration']::varchar[],
            TRUE,
            NOW(),
            FALSE,
            0,
            NOW() - interval '8 hours',
            NOW() - interval '8 hours'
        )
    ) AS seed(
        id, ticket_number, ticket_type, title, description, status, priority,
        reporter_user_id, assigned_team_id, organization_id, category_id, subcategory_id,
        source, tags, gdpr_consent, gdpr_consent_at, is_major, escalation_level,
        created_at, updated_at
    )
    ON CONFLICT (ticket_number) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        status = EXCLUDED.status,
        priority = EXCLUDED.priority,
        assigned_team_id = EXCLUDED.assigned_team_id,
        tags = EXCLUDED.tags,
        source = EXCLUDED.source,
        updated_at = NOW();

    RAISE NOTICE 'Seeded portal landsportal demo tickets (LP-2026-00001..00005)';
END $$;
