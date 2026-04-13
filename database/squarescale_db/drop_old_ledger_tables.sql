-- Old ledger_entries DDL had invalid UNIQUE(account_id) / UNIQUE(journal_id) (only one row per account or journal).
-- Run once, then restart Spring Boot so Hibernate can recreate ledger_entries from entities.

USE squarescale;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS ledger_entries;
SET FOREIGN_KEY_CHECKS = 1;
