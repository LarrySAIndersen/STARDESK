-- Optional one-time fix for existing Neon/prod data (Slack/Gmail for SF admins).
-- Not required after API org-resolution deploy: admins with NULL organization_id
-- automatically scope integrations to "SF Operations" (or first active org).
--
-- Use this only if you want Larry (and similar admins) to have an explicit org in users table.

UPDATE users u
SET organization_id = o.id,
    updated_at = NOW()
FROM organizations o
WHERE u.email = 'larrysanders@example.dk'
  AND u.deleted_at IS NULL
  AND u.organization_id IS NULL
  AND o.name = 'SF Operations'
  AND o.is_active = TRUE;
