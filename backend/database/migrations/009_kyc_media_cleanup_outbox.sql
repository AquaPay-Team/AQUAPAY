CREATE TABLE IF NOT EXISTS kyc_media_cleanup_outbox (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  case_id BIGINT UNSIGNED NOT NULL,
  media_asset_id BIGINT UNSIGNED NOT NULL,

  storage_provider VARCHAR(50) NOT NULL,
  storage_key VARCHAR(500) NOT NULL,
  resource_type VARCHAR(20) NOT NULL,

  status ENUM(
    'pending',
    'processing',
    'completed',
    'failed'
  ) NOT NULL DEFAULT 'pending',

  attempts INT UNSIGNED NOT NULL DEFAULT 0,
last_error TEXT DEFAULT NULL,

-- Worker crash recovery and retry scheduling
locked_at TIMESTAMP NULL DEFAULT NULL,
next_attempt_at TIMESTAMP NULL DEFAULT NULL,

created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL DEFAULT NULL,

  PRIMARY KEY (id),

 UNIQUE KEY uq_media_cleanup_asset (media_asset_id),
  KEY idx_media_cleanup_pending (status, next_attempt_at, created_at),
  KEY idx_media_cleanup_locked (status, locked_at),
  KEY idx_media_cleanup_case_id (case_id)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;
