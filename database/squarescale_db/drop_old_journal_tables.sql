-- Run once if you previously imported broken journal DDL (invalid UNIQUE keys on journal_lines / journal_attachments).
-- Stops Hibernate ddl-auto=update from fighting the old schema. Then restart the Spring Boot app to recreate tables.

USE squarescale;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS journal_attachments;
DROP TABLE IF EXISTS journal_lines;
DROP TABLE IF EXISTS journal_entries;
SET FOREIGN_KEY_CHECKS = 1;
