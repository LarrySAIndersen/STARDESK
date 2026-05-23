-- Prototype/demo accounts: stop forcing first-login password change in prod DBs
UPDATE users
SET must_change_password = FALSE,
    password_policy_exempt = TRUE,
    updated_at = NOW()
WHERE deleted_at IS NULL
  AND email IN (
    'submitter@example.dk',
    'agent@example.dk',
    'admin@example.dk',
    'larrysanders@example.dk',
    'larrysanders2@example.dk'
  );
