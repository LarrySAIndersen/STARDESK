-- Auth: password login (run once in Neon after init.sql)
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
