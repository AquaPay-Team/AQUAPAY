-- Preserve media evidence history when an agent replaces an asset of the same
-- type. Existing rows are unchanged; replacement code marks only the former
-- current row as superseded inside the transaction that inserts its successor.
ALTER TABLE media_assets
  MODIFY COLUMN status ENUM('uploaded', 'verified', 'rejected', 'superseded')
    NOT NULL DEFAULT 'uploaded';

-- Rollback consideration: this migration can be reversed only after confirming
-- no media_assets rows have status='superseded'. Preserve/export such rows and
-- choose a reviewed status mapping before removing the enum value.
