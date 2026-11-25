-- Session generation counter used to invalidate all previously issued JWTs
-- (and any refresh/session tokens derived from them) immediately when an
-- administrator deactivates or blocks an account.

ALTER TABLE users
  ADD COLUMN token_version INT UNSIGNED NOT NULL DEFAULT 0 AFTER status;
