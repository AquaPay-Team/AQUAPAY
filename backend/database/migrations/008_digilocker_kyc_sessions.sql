-- Persist DigiLocker authorization and callback state in MySQL.
-- Authorization state is stored only as a SHA-256 digest. Provider reference keys
-- are encrypted by the application before insertion.

USE fintech_kyc;

CREATE TABLE IF NOT EXISTS kyc_digilocker_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  session_uuid CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  case_id BIGINT UNSIGNED NOT NULL,
  verification_id BIGINT UNSIGNED NOT NULL,
  verification_type ENUM('aadhaar', 'pan') NOT NULL,
  provider VARCHAR(50) NOT NULL,
  authorization_session_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  authorization_state_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  authorization_code_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  code_verifier_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  state_expires_at DATETIME(3) NOT NULL,
  status ENUM('pending', 'processing', 'verified', 'failed', 'expired') NOT NULL DEFAULT 'pending',
  current_stage VARCHAR(40) NOT NULL DEFAULT 'authorization_pending',
  provider_init_status VARCHAR(40) DEFAULT NULL,
  provider_init_code VARCHAR(32) DEFAULT NULL,
  provider_init_metadata JSON DEFAULT NULL,
  reference_key_ciphertext MEDIUMBLOB DEFAULT NULL,
  reference_key_iv BINARY(12) DEFAULT NULL,
  reference_key_authentication_tag BINARY(16) DEFAULT NULL,
  reference_key_version SMALLINT UNSIGNED DEFAULT NULL,
  reference_expires_at DATETIME(3) DEFAULT NULL,
  failure_code VARCHAR(100) DEFAULT NULL,
  consumed_at DATETIME(3) DEFAULT NULL,
  verified_at DATETIME(3) DEFAULT NULL,
  active_verification_id BIGINT UNSIGNED
    GENERATED ALWAYS AS (
      CASE WHEN status IN ('pending', 'processing') THEN verification_id ELSE NULL END
    ) STORED,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_kyc_digilocker_session_uuid (session_uuid),
  UNIQUE KEY uq_kyc_digilocker_state_hash (authorization_state_hash),
  UNIQUE KEY uq_kyc_digilocker_active_verification (active_verification_id),
  KEY idx_kyc_digilocker_user_case (user_id, case_id, verification_type, created_at),
  KEY idx_kyc_digilocker_verification (verification_id, created_at),
  KEY idx_kyc_digilocker_expiry (status, state_expires_at),
  CONSTRAINT fk_kyc_digilocker_user
    FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_kyc_digilocker_case
    FOREIGN KEY (case_id) REFERENCES kyc_cases(id) ON DELETE CASCADE,
  CONSTRAINT fk_kyc_digilocker_verification
    -- verification_id is the base column of active_verification_id, a stored
    -- generated column. MySQL prohibits cascading actions on such base columns.
    -- Restrict deletion while a session references the verification instead.
    FOREIGN KEY (verification_id) REFERENCES kyc_verifications(id),
  CONSTRAINT chk_kyc_digilocker_reference_key_parts
    CHECK (
      (reference_key_ciphertext IS NULL AND reference_key_iv IS NULL AND
       reference_key_authentication_tag IS NULL AND reference_key_version IS NULL)
      OR
      (reference_key_ciphertext IS NOT NULL AND reference_key_iv IS NOT NULL AND
       reference_key_authentication_tag IS NOT NULL AND reference_key_version IS NOT NULL)
    )
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;
