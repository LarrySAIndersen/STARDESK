-- Restore ticket org + SLA linkage from gamma / standard setup (safe to re-run)

-- 1) Organisation from assigned team
UPDATE tickets t
SET organization_id = tm.organization_id,
    updated_at = NOW()
FROM teams tm
WHERE t.assigned_team_id = tm.id
  AND t.deleted_at IS NULL
  AND t.organization_id IS NULL
  AND tm.organization_id IS NOT NULL;

-- 2) Organisation from reporter (fallback)
UPDATE tickets t
SET organization_id = u.organization_id,
    updated_at = NOW()
FROM users u
WHERE t.reporter_user_id = u.id
  AND t.deleted_at IS NULL
  AND t.organization_id IS NULL
  AND u.organization_id IS NOT NULL;

-- 3) Clear escalation counters (SLA reset API recalculates due dates)
UPDATE tickets
SET escalation_level = 0,
    last_escalation_at = NULL,
    updated_at = NOW()
WHERE deleted_at IS NULL
  AND (escalation_level <> 0 OR last_escalation_at IS NOT NULL);

-- 4) Backfill assigned_at where team/user set but timestamp missing
UPDATE tickets t
SET assigned_at = COALESCE(t.assigned_at, t.created_at),
    updated_at = NOW()
WHERE t.deleted_at IS NULL
  AND t.assigned_at IS NULL
  AND (t.assigned_team_id IS NOT NULL OR t.assigned_user_id IS NOT NULL);

-- 5) Ensure SLA policy id matches priority (global assignments)
UPDATE tickets t
SET sla_policy_id = p.id,
    updated_at = NOW()
FROM sla_policies p
WHERE t.deleted_at IS NULL
  AND p.name = CASE t.priority
      WHEN 'critical' THEN 'Critical (24/7)'
      WHEN 'high' THEN 'High'
      WHEN 'medium' THEN 'Medium'
      WHEN 'low' THEN 'Low'
      ELSE 'Medium'
  END
  AND (t.sla_policy_id IS NULL OR t.sla_policy_id <> p.id);
