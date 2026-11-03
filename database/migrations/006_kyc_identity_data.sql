-- Encrypted identity fields for Aadhaar and PAN KYC verification.
-- This migration is additive; identity payloads are never stored in plaintext.

CREATE TABLE IF NOT EXISTS kyc_identity_data (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  case_id BIGINT UNSIGNED NOT NULL,
  verification_id BIGINT UNSIGNED NOT NULL,
  identity_type ENUM('aadhaar', 'pan') NOT NULL,
  payload_ciphertext MEDIUMBLOB NOT NULL,
  payload_iv BINARY(12) NOT NULL,
  payload_authentication_tag BINARY(16) NOT NULL,
  encryption_key_version SMALLINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_kyc_identity_data_case_type (case_id, identity_type),
  UNIQUE KEY uq_kyc_identity_data_verification (verification_id),
  KEY idx_kyc_identity_data_user_case (user_id, case_id),
  CONSTRAINT fk_kyc_identity_data_user
    FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_kyc_identity_data_case
    FOREIGN KEY (case_id) REFERENCES kyc_cases(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_kyc_identity_data_verification
    FOREIGN KEY (verification_id) REFERENCES kyc_verifications(id)
    ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;