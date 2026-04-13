-- Run once if you already created `notifications` from an older dump that had UNIQUE(user_id).
-- Enables multiple notifications per user and links to journal entries.
USE squarescale;

ALTER TABLE notifications DROP INDEX user_id_UNIQUE;

ALTER TABLE notifications MODIFY COLUMN notification_id INT NOT NULL AUTO_INCREMENT;

ALTER TABLE notifications ADD COLUMN journal_entry_id INT NULL;
