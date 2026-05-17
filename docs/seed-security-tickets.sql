-- Mark sample demo tickets as sikkerhedssager (safe to re-run)
-- Run after seed-group-sample-tickets.sql

UPDATE tickets
SET is_security_ticket = TRUE,
    updated_at = NOW()
WHERE ticket_number LIKE 'DEMO-%'
  AND title ILIKE '% demo 1'
  AND deleted_at IS NULL;
