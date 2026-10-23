
-- AQUAPAY Phase 2: KYC schema
-- Requires the existing users table.
-- Do not store raw Aadhaar, PAN, or bank account numbers in plaintext.

CREATE TABLE IF NOT EXISTS kyc_cases (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  business_type VARCHAR(100) DEFAULT NULL,
  status ENUM(
    'draft',
    'submitted',
    'under_review',
    'approved',
    'rejected'
  ) NOT NULL DEFAULT 'draft',
  current_step TINYINT UNSIGNED NOT NULL DEFAULT 1,
  submitted_at DATETIME DEFAULT NULL,
  reviewed_at DATETIME DEFAULT NULL,
  rejection_reason VARCHAR(500) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_kyc_cases_user_status (user_id, status),
  KEY idx_kyc_cases_status_created (status, created_at),
  CONSTRAINT fk_kyc_cases_user
    FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT chk_kyc_cases_current_step
    CHECK (current_step BETWEEN 1 AND 7)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE IF NOT EXISTS kyc_steps (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  case_id BIGINT UNSIGNED NOT NULL,
  step_number TINYINT UNSIGNED NOT NULL,
  status ENUM(
    'pending',
    'in_progress',
    'completed',
    'failed'
  ) NOT NULL DEFAULT 'pending',
  completed_at DATETIME DEFAULT NULL,
  failure_code VARCHAR(100) DEFAULT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_kyc_steps_case_step (case_id, step_number),
  CONSTRAINT fk_kyc_steps_case
    FOREIGN KEY (case_id) REFERENCES kyc_cases(id)
    ON DELETE CASCADE,
  CONSTRAINT chk_kyc_steps_number
    CHECK (step_number BETWEEN 1 AND 7)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE IF NOT EXISTS kyc_verifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  case_id BIGINT UNSIGNED NOT NULL,
  verification_type ENUM('aadhaar', 'pan') NOT NULL,
  provider VARCHAR(50) NOT NULL,
  provider_reference VARCHAR(255) DEFAULT NULL,
  status ENUM(
    'pending',
    'verified',
    'failed'
  ) NOT NULL DEFAULT 'pending',
  masked_identifier VARCHAR(32) DEFAULT NULL,
  verified_name VARCHAR(150) DEFAULT NULL,
  failure_code VARCHAR(100) DEFAULT NULL,
  verified_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_kyc_verifications_case_type (case_id, verification_type),
  KEY idx_kyc_verifications_provider_ref (provider, provider_reference),
  CONSTRAINT fk_kyc_verifications_case
    FOREIGN KEY (case_id) REFERENCES kyc_cases(id)
    ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE IF NOT EXISTS bank_accounts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  case_id BIGINT UNSIGNED NOT NULL,
  account_holder_name VARCHAR(150) NOT NULL,
  bank_name VARCHAR(150) DEFAULT NULL,
  ifsc_code VARCHAR(11) NOT NULL,
  account_number_encrypted VARBINARY(512) NOT NULL,
  account_number_last4 CHAR(4) NOT NULL,
  verification_status ENUM(
    'pending',
    'verified',
    'failed'
  ) NOT NULL DEFAULT 'pending',
  provider_reference VARCHAR(255) DEFAULT NULL,
  verified_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_bank_accounts_case (case_id),
  CONSTRAINT fk_bank_accounts_case
    FOREIGN KEY (case_id) REFERENCES kyc_cases(id)
    ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE IF NOT EXISTS media_assets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  case_id BIGINT UNSIGNED NOT NULL,
  asset_type ENUM(
    'shop_image',
    'selfie',
    'consent_video'
  ) NOT NULL,
  storage_provider VARCHAR(50) NOT NULL,
  storage_key VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size_bytes BIGINT UNSIGNED NOT NULL,
  status ENUM(
    'uploaded',
    'verified',
    'rejected'
  ) NOT NULL DEFAULT 'uploaded',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_media_assets_case_type (case_id, asset_type),
  CONSTRAINT fk_media_assets_case
    FOREIGN KEY (case_id) REFERENCES kyc_cases(id)
    ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE IF NOT EXISTS agreement_acceptances (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  case_id BIGINT UNSIGNED NOT NULL,
  agreement_code VARCHAR(100) NOT NULL,
  agreement_version VARCHAR(50) NOT NULL,
  accepted_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_agreement_case_version (
    case_id,
    agreement_code,
    agreement_version
  ),
  CONSTRAINT fk_agreement_acceptances_case
    FOREIGN KEY (case_id) REFERENCES kyc_cases(id)
    ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE IF NOT EXISTS kyc_status_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  case_id BIGINT UNSIGNED NOT NULL,
  old_status VARCHAR(30) DEFAULT NULL,
  new_status VARCHAR(30) NOT NULL,
  actor_user_id BIGINT UNSIGNED DEFAULT NULL,
  reason VARCHAR(500) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_kyc_status_history_case_time (case_id, created_at),
  CONSTRAINT fk_kyc_status_history_case
    FOREIGN KEY (case_id) REFERENCES kyc_cases(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_kyc_status_history_actor
    FOREIGN KEY (actor_user_id) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;
