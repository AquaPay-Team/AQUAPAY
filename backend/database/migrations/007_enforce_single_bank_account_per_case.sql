
-- Ensure only one bank account exists per KYC case.
-- Safe for both fresh databases and databases where the unique
-- constraint was already created manually.

SET @has_unique_index := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bank_accounts'
    AND INDEX_NAME = 'uq_bank_accounts_case'
    AND NON_UNIQUE = 0
);

SET @has_unique_name := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bank_accounts'
    AND INDEX_NAME = 'uq_bank_accounts_case'
);

SET @has_old_index := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bank_accounts'
    AND INDEX_NAME = 'idx_bank_accounts_case'
);

SET @migration_sql := CASE
  WHEN @has_unique_index > 0 THEN
    'SELECT 1'

  WHEN @has_unique_name > 0 THEN
    'ALTER TABLE bank_accounts DROP INDEX uq_bank_accounts_case, ADD CONSTRAINT uq_bank_accounts_case UNIQUE (case_id)'

  WHEN @has_old_index > 0 THEN
    'ALTER TABLE bank_accounts DROP INDEX idx_bank_accounts_case, ADD CONSTRAINT uq_bank_accounts_case UNIQUE (case_id)'

  ELSE
    'ALTER TABLE bank_accounts ADD CONSTRAINT uq_bank_accounts_case UNIQUE (case_id)'
END;

PREPARE migration_statement FROM @migration_sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;
