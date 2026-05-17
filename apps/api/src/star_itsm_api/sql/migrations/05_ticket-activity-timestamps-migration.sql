-- Activity milestone timestamps on tickets — run once in Neon

ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS in_progress_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS on_hold_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ;

-- Backfill from ticket_events where possible (optional, safe to re-run)
UPDATE tickets t
SET assigned_at = sub.occurred_at
FROM (
    SELECT ticket_id, MIN(created_at) AS occurred_at
    FROM ticket_events
    WHERE event_type IN ('ticket.assigned', 'ticket.created')
    GROUP BY ticket_id
) sub
WHERE t.id = sub.ticket_id
  AND t.assigned_at IS NULL
  AND (t.assigned_team_id IS NOT NULL OR t.assigned_user_id IS NOT NULL);

UPDATE tickets t
SET resolved_at = sub.occurred_at
FROM (
    SELECT ticket_id, MIN(created_at) AS occurred_at
    FROM ticket_events
    WHERE event_type = 'ticket.status_changed'
      AND payload->>'status' = 'resolved'
    GROUP BY ticket_id
) sub
WHERE t.id = sub.ticket_id AND t.resolved_at IS NULL;

UPDATE tickets t
SET closed_at = sub.occurred_at
FROM (
    SELECT ticket_id, MIN(created_at) AS occurred_at
    FROM ticket_events
    WHERE event_type = 'ticket.status_changed'
      AND payload->>'status' = 'closed'
    GROUP BY ticket_id
) sub
WHERE t.id = sub.ticket_id AND t.closed_at IS NULL;
