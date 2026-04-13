-- Notifications: one row per alert per recipient (managers/admins for journal approvals).
USE squarescale;

DROP TABLE IF EXISTS `notifications`;

CREATE TABLE `notifications` (
  `notification_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `message` longtext,
  `is_read` tinyint DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `journal_entry_id` int DEFAULT NULL,
  PRIMARY KEY (`notification_id`),
  KEY `idx_notifications_user` (`user_id`),
  CONSTRAINT `notifications_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`userID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
