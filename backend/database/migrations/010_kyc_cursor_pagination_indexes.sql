-- Admin KYC cursor (keyset) pagination indexes.
-- Supports WHERE status IN (...) ORDER BY submitted_at DESC, id DESC
-- with a seek predicate on (submitted_at, id) instead of OFFSET.
-- Additive and safe to re-run.

SET @schema_name := DATABASE();

SET @has_idx_kyc_cases_status_submitted_at_id := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'kyc_cases'
    AND INDEX_NAME = 'idx_kyc_cases_status_submitted_at_id'
);
SET @sql_kyc_cases_status_submitted_at_id := IF(
  @has_idx_kyc_cases_status_submitted_at_id = 0,
  'CREATE INDEX idx_kyc_cases_status_submitted_at_id ON kyc_cases (status, submitted_at DESC, id DESC)',
  'SELECT 1'
);
PREPARE statement_kyc_cases_status_submitted_at_id FROM @sql_kyc_cases_status_submitted_at_id;
EXECUTE statement_kyc_cases_status_submitted_at_id;
DEALLOCATE PREPARE statement_kyc_cases_status_submitted_at_id;
