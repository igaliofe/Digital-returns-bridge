-- Optimistic locking support for return_requests (JPA @Version).
-- Apply to existing databases created before the version column was added to schema.sql.

ALTER TABLE return_requests ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
