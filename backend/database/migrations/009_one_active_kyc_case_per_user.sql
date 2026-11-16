-- Enforce at most one active KYC case per user while retaining every closed case.
-- Active includes the legacy `draft` status because migration 005 leaves that
-- value in the ENUM, even though current application code creates `pending`.
-- Preflight before deployment:
--   SELECT user_id, COUNT(*) FROM kyc_cases
--   WHERE status IN ('draft','pending','submitted','under_review')
--   GROUP BY user_id HAVING COUNT(*) > 1;
-- This ALTER is additive and the generated column plus unique index are applied
-- together. If duplicate data is introduced after preflight, MySQL rejects the
-- ALTER without changing existing KYC records.

ALTER TABLE kyc_cases
  ADD COLUMN active_user_id BIGINT UNSIGNED
    GENERATED ALWAYS AS (
      CASE
        WHEN status IN ('draft', 'pending', 'submitted', 'under_review')
          THEN user_id
        ELSE NULL
      END
    ) STORED,
  ADD UNIQUE KEY uq_kyc_cases_one_active_user (active_user_id);
