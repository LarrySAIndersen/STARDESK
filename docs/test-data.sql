-- =====================================================================
-- Test data for STARdesk (paste into Neon SQL Editor)
-- =====================================================================
-- Requires init.sql to have been run first (seed user must exist).
-- =====================================================================

INSERT INTO tickets (
    ticket_number,
    ticket_type,
    title,
    description,
    status,
    priority,
    reporter_user_id,
    source
) VALUES (
    'INC-2025-00001',
    'incident',
    'Kan ikke logge på VPN',
    'Bruger får fejl 403 ved forbindelse til corporate VPN fra hjemmekontor.',
    'new',
    'high',
    '00000000-0000-0000-0000-000000000001',
    'portal'
);
