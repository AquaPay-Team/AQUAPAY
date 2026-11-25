-- Persisted operational metrics for the Admin Server & Reports page.
-- Stores hourly-aggregated API telemetry so historical reports survive
-- backend restarts and are not limited to in-memory process-local state.
-- Safe to re-run: CREATE TABLE IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS api_request_metrics (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  bucket_hour DATETIME NOT NULL,
  total_requests INT UNSIGNED NOT NULL DEFAULT 0,
  error_5xx_count INT UNSIGNED NOT NULL DEFAULT 0,
  error_4xx_count INT UNSIGNED NOT NULL DEFAULT 0,
  total_latency_ms BIGINT UNSIGNED NOT NULL DEFAULT 0,
  mysql_latency_ms INT UNSIGNED NULL,
  redis_latency_ms INT UNSIGNED NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_bucket_hour (bucket_hour)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
