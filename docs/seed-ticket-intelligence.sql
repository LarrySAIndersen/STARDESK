-- Enrich demo + sample tickets with LLM-friendly semantic metadata (safe to re-run)

UPDATE tickets SET
    semantic_topics = ARRAY['demo', 'onboarding', 'tildeling'],
    ease_score = 5,
    complexity_score = 1,
    llm_summary = 'Demosag til gruppeoversigt — ingen reel fejl, velegnet som skoleeksempel.',
    handling_hints = ARRAY[
        'Bruges kun til UI-test og drag-and-drop.',
        'Forvent lethed 5/5 — luk eller ignorer i produktion.'
    ],
    intelligence_source = 'seed',
    intelligence_updated_at = NOW()
WHERE ticket_number LIKE 'DEMO-%'
  AND deleted_at IS NULL;

UPDATE tickets SET
    semantic_topics = ARRAY['printer', 'hardware', 'kontor'],
    ease_score = 4,
    complexity_score = 2,
    llm_summary = 'Printerproblem — typisk driver eller kø; hurtig løsning sandsynlig.',
    handling_hints = ARRAY[
        'Bekræft printernavn og afdeling.',
        'Tjek om andre brugere har samme problem.'
    ],
    intelligence_source = 'seed',
    intelligence_updated_at = NOW()
WHERE deleted_at IS NULL
  AND (title ILIKE '%printer%' OR description ILIKE '%printer%')
  AND intelligence_source IS NULL;

UPDATE tickets SET
    semantic_topics = ARRAY['vpn', 'adgang', 'remote'],
    ease_score = 3,
    complexity_score = 3,
    llm_summary = 'VPN eller fjernadgang — kræver identitets- og netværksafklaring.',
    handling_hints = ARRAY[
        'Verificer brugerens enhed og MFA-status.',
        'Sammenlign med kendte VPN-udfald.'
    ],
    intelligence_source = 'seed',
    intelligence_updated_at = NOW()
WHERE deleted_at IS NULL
  AND (title ILIKE '%vpn%' OR description ILIKE '%vpn%' OR 'vpn' = ANY(tags))
  AND intelligence_source IS NULL;

UPDATE tickets SET
    semantic_topics = ARRAY['sikkerhed', 'gdpr', 'adgang'],
    ease_score = 2,
    complexity_score = 4,
    llm_summary = 'Sikkerheds- eller GDPR-relateret — eskalér ved tvivl, dokumentér handlinger.',
    handling_hints = ARRAY[
        'Følg STAR sikkerhedsprocedure.',
        'Undgå at dele persondata i eksterne kommentarer.'
    ],
    intelligence_source = 'seed',
    intelligence_updated_at = NOW()
WHERE deleted_at IS NULL
  AND (title ILIKE '%gdpr%' OR title ILIKE '%sikkerhed%' OR emoji = '🔒')
  AND intelligence_source IS NULL;

UPDATE tickets SET
    semantic_topics = ARRAY['nedetid', 'eskalering', 'stor-sag'],
    ease_score = 1,
    complexity_score = 5,
    llm_summary = 'Stor sag eller nedetid — koordiner kommunikation og eskalering.',
    handling_hints = ARRAY[
        'Aktivér major-incident rutine hvis relevant.',
        'Opdater berørte grupper løbende.'
    ],
    intelligence_source = 'seed',
    intelligence_updated_at = NOW()
WHERE deleted_at IS NULL
  AND is_major = TRUE
  AND intelligence_source IS NULL;
