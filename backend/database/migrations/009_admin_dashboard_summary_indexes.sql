-- Dashboard summary aggregation indexes.
-- These are additive and use information_schema checks for safe re-runs.

SET @schema_name := DATABASE();

SET @has_idx_users_status := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'users'
    AND INDEX_NAME = 'idx_users_status'
);
SET @sql_users_status := IF(
  @has_idx_users_status = 0,
  'CREATE INDEX idx_users_status ON users (status)',
  'SELECT 1'
);
PREPARE statement_users_status FROM @sql_users_status;
EXECUTE statement_users_status;
DEALLOCATE PREPARE statement_users_status;

SET @has_idx_users_created_at := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'users'
    AND INDEX_NAME = 'idx_users_created_at'
);
SET @sql_users_created_at := IF(
  @has_idx_users_created_at = 0,
  'CREATE INDEX idx_users_created_at ON users (created_at)',
  'SELECT 1'
);
PREPARE statement_users_created_at FROM @sql_users_created_at;
EXECUTE statement_users_created_at;
DEALLOCATE PREPARE statement_users_created_at;

SET @has_idx_kyc_status_reviewed_at := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'kyc_cases'
    AND INDEX_NAME = 'idx_kyc_cases_status_reviewed_at'
);
SET @sql_kyc_status_reviewed_at := IF(
  @has_idx_kyc_status_reviewed_at = 0,
  'CREATE INDEX idx_kyc_cases_status_reviewed_at ON kyc_cases (status, reviewed_at)',
  'SELECT 1'
);
PREPARE statement_kyc_status_reviewed_at FROM @sql_kyc_status_reviewed_at;
EXECUTE statement_kyc_status_reviewed_at;
DEALLOCATE PREPARE statement_kyc_status_reviewed_at;
