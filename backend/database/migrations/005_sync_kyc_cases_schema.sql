-- AQUAPAY Phase 2 KYC: Forward schema synchronization
-- Adds steps_completed, preserves current_step, updates status ENUM,
-- backfills steps_completed from completed kyc_steps, and maps draft to pending.

USE fintech_kyc;

-- 1. Ensure steps_completed column exists with default 0
SET @exist_steps_completed := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'kyc_cases' AND COLUMN_NAME = 'steps_completed'
);
SET @sql_add_steps_completed := IF(@exist_steps_completed = 0,
  'ALTER TABLE kyc_cases ADD COLUMN steps_completed TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER status',
  'SELECT 1'
);
PREPARE stmt_sc FROM @sql_add_steps_completed;
EXECUTE stmt_sc;
DEALLOCATE PREPARE stmt_sc;

-- 2. Ensure current_step column is preserved for backwards compatibility
SET @exist_current_step := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'kyc_cases' AND COLUMN_NAME = 'current_step'
);
SET @sql_add_current_step := IF(@exist_current_step = 0,
  'ALTER TABLE kyc_cases ADD COLUMN current_step TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER status',
  'SELECT 1'
);
PREPARE stmt_cs FROM @sql_add_current_step;
EXECUTE stmt_cs;
DEALLOCATE PREPARE stmt_cs;

-- 3. Ensure check constraint for steps_completed exists (0 to 7)
SET @exist_chk_steps := (
  SELECT COUNT(*) FROM information_schema.CHECK_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'chk_kyc_cases_steps_completed'
);
SET @sql_add_chk_steps := IF(@exist_chk_steps = 0,
  'ALTER TABLE kyc_cases ADD CONSTRAINT chk_kyc_cases_steps_completed CHECK (steps_completed BETWEEN 0 AND 7)',
  'SELECT 1'
);
PREPARE stmt_chk_sc FROM @sql_add_chk_steps;
EXECUTE stmt_chk_sc;
DEALLOCATE PREPARE stmt_chk_sc;

-- 4. Ensure check constraint for current_step exists (1 to 7)
SET @exist_chk_current := (
  SELECT COUNT(*) FROM information_schema.CHECK_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'chk_kyc_cases_current_step'
);
SET @sql_add_chk_current := IF(@exist_chk_current = 0,
  'ALTER TABLE kyc_cases ADD CONSTRAINT chk_kyc_cases_current_step CHECK (current_step BETWEEN 1 AND 7)',
  'SELECT 1'
);
PREPARE stmt_chk_cs FROM @sql_add_chk_current;
EXECUTE stmt_chk_cs;
DEALLOCATE PREPARE stmt_chk_cs;

-- 5. Update status ENUM to include both 'draft' and 'pending' with default 'pending'
ALTER TABLE kyc_cases
  MODIFY COLUMN status ENUM('draft','pending','submitted','under_review','approved','rejected')
  NOT NULL DEFAULT 'pending';

-- 6. Backfill steps_completed based on actual completed kyc_steps records
UPDATE kyc_cases kc
SET steps_completed = (
  SELECT COUNT(*)
  FROM kyc_steps ks
  WHERE ks.case_id = kc.id
    AND ks.status = 'completed'
);

-- 7. Convert legacy draft status to pending
UPDATE kyc_cases
SET status = 'pending'
WHERE status = 'draft';
