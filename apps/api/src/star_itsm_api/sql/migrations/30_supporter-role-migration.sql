-- Allow supporter rettighedsgruppe (sync with alembic 20260520_supporter)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('end_user', 'agent', 'admin', 'top_admin', 'supporter'));
