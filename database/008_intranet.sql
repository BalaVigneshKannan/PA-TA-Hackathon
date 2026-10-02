-- Institutional identities remain stable when email or student numbers change.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE students ADD COLUMN academic_source TEXT NOT NULL DEFAULT 'local';
ALTER TABLE students ADD COLUMN academic_synced_at TIMESTAMPTZ;
CREATE TABLE intranet_identities (
 issuer TEXT NOT NULL, subject TEXT NOT NULL,
 user_id UUID NOT NULL UNIQUE REFERENCES users(id),
 PRIMARY KEY(issuer,subject)
);
CREATE TABLE intranet_assertions (
 issuer TEXT NOT NULL, token_id TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
 PRIMARY KEY(issuer,token_id)
);
