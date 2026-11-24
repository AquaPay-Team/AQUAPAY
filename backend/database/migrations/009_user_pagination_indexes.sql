-- Migration 009: Composite indexes for server-side user directory sorting and pagination
ALTER TABLE users
  ADD INDEX idx_users_role_status_created (role_id, status, created_at DESC, id DESC),
  ADD INDEX idx_users_created_id (created_at DESC, id DESC);