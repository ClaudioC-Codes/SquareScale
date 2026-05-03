-- =============================================================================
-- VIDEO DEMO DATA for Brandon test users (MySQL / database `squarescale`)
-- Run AFTER Spring Boot has created ss_journal_* tables at least once
--   (or start the app once with ddl-auto=update), OR comment out journal section.
--
-- User IDs (from squarescale_users.sql):
--   regularBrandon  = 4   |  managerBrandon = 5   |  adminBrandon = 6
--
-- Removes prior demo rows tagged with account numbers / descriptions below,
-- then inserts chart-of-accounts balances tuned so the dashboard shows a mix of
-- GREEN / YELLOW / RED ratio cards, plus two PENDING journal entries for alerts.
-- =============================================================================

USE squarescale;

-- ----- Remove old demo journal rows (description prefix) ---------------------
DELETE l FROM `ss_journal_lines` l
INNER JOIN `ss_journal_entries` e ON e.`id` = l.`journal_entry_id`
WHERE e.`description` LIKE 'VIDEO DEMO%';

DELETE a FROM `ss_journal_attachments` a
INNER JOIN `ss_journal_entries` e ON e.`id` = a.`journal_entry_id`
WHERE e.`description` LIKE 'VIDEO DEMO%';

DELETE FROM `ss_journal_entries` WHERE `description` LIKE 'VIDEO DEMO%';

-- ----- Remove old demo accounts (if re-running) -------------------------------
DELETE FROM `accounts` WHERE `accountNumber` IN (
  '9101','9102','9103','9201','9301','4199','5199','5299'
);

-- ----- Chart of accounts (adminBrandon = userId 6 owns seed rows) -------------
INSERT INTO `accounts` (
  `accountName`, `accountNumber`, `description`, `normalSide`,
  `accountCategory`, `accountSubcategory`,
  `initialBalance`, `debit`, `credit`, `balance`,
  `createdAt`, `userId`, `accountOrder`, `statementType`, `commentText`, `isActive`
) VALUES
(
  'VIDEO DEMO — Cash',
  '9101',
  'Demo: current asset',
  'Debit',
  'Asset',
  'Current Assets',
  0.00, 80000.00, 0.00, 80000.00,
  NOW(), 6, 'D01', 'BS', 'Video demo — safe to delete', 1
),
(
  'VIDEO DEMO — Accounts Receivable',
  '9102',
  'Demo: current asset',
  'Debit',
  'Asset',
  'Current Assets',
  0.00, 40000.00, 0.00, 40000.00,
  NOW(), 6, 'D02', 'BS', 'Video demo', 1
),
(
  'VIDEO DEMO — Inventory',
  '9103',
  'Demo: inventory for turnover / quick ratio',
  'Debit',
  'Asset',
  'Inventory',
  0.00, 65000.00, 0.00, 65000.00,
  NOW(), 6, 'D03', 'BS', 'Video demo', 1
),
(
  'VIDEO DEMO — Accounts Payable',
  '9201',
  'Demo: current liability (credit balance)',
  'Credit',
  'Liability',
  'Current Liabilities',
  0.00, 0.00, 95000.00, -95000.00,
  NOW(), 6, 'D04', 'BS', 'Video demo', 1
),
(
  'VIDEO DEMO — Retained Earnings',
  '9301',
  'Demo: equity (positive balance field for class demo)',
  'Credit',
  'Equity',
  'Retained Earnings',
  100000.00, 0.00, 0.00, 100000.00,
  NOW(), 6, 'D05', 'BS', 'Video demo', 1
),
(
  'VIDEO DEMO — Sales Revenue',
  '4199',
  'Demo: P&L revenue (4xxx)',
  'Credit',
  'Revenue',
  'Operating',
  0.00, 0.00, 180000.00, -180000.00,
  NOW(), 6, 'D06', 'IS', 'Video demo', 1
),
(
  'VIDEO DEMO — Cost of Goods Sold',
  '5199',
  'Demo: COGS (5xxx)',
  'Debit',
  'Expense',
  'COGS',
  0.00, 95000.00, 0.00, 95000.00,
  NOW(), 6, 'D07', 'IS', 'Video demo', 1
),
(
  'VIDEO DEMO — Operating Expense',
  '5299',
  'Demo: other expense (5xxx)',
  'Debit',
  'Expense',
  'Operating',
  0.00, 75000.00, 0.00, 75000.00,
  NOW(), 6, 'D08', 'IS', 'Video demo', 1
);

-- Intentionally “stressed” numbers vs dashboard thresholds:
--   Current assets 185k / current liab 95k  -> current ratio ~1.95 (YELLOW band)
--   Quick ratio (185k - 65k) / 95k ~1.26 (GREEN)
--   Inventory high vs COGS -> inventory turnover on the low side (YELLOW/RED)
--   Net margin small positive -> YELLOW possible on net margin card

-- ----- Two PENDING journal entries (creator regularBrandon = 4) --------------
INSERT INTO `ss_journal_entries` (
  `entryDate`, `description`, `entryType`, `created_by_user_id`,
  `status`, `totalDebit`, `totalCredit`, `createdAt`
) VALUES (
  CURDATE(),
  'VIDEO DEMO — Office supplies accrual (pending)',
  'REGULAR',
  4,
  'PENDING',
  250.00,
  250.00,
  NOW()
);
SET @je1 := LAST_INSERT_ID();

INSERT INTO `ss_journal_lines` (
  `journal_entry_id`, `lineType`, `accountId`, `amount`, `description`
) VALUES
(
  @je1,
  'DEBIT',
  (SELECT `accountId` FROM `accounts` WHERE `accountNumber` = '5299' LIMIT 1),
  250.00,
  'Supplies expense'
),
(
  @je1,
  'CREDIT',
  (SELECT `accountId` FROM `accounts` WHERE `accountNumber` = '9201' LIMIT 1),
  250.00,
  'Accrued payable'
);

INSERT INTO `ss_journal_entries` (
  `entryDate`, `description`, `entryType`, `created_by_user_id`,
  `status`, `totalDebit`, `totalCredit`, `createdAt`
) VALUES (
  CURDATE(),
  'VIDEO DEMO — Customer receipt on account (pending)',
  'REGULAR',
  4,
  'PENDING',
  1200.00,
  1200.00,
  NOW()
);
SET @je2 := LAST_INSERT_ID();

INSERT INTO `ss_journal_lines` (
  `journal_entry_id`, `lineType`, `accountId`, `amount`, `description`
) VALUES
(
  @je2,
  'DEBIT',
  (SELECT `accountId` FROM `accounts` WHERE `accountNumber` = '9101' LIMIT 1),
  1200.00,
  'Cash received'
),
(
  @je2,
  'CREDIT',
  (SELECT `accountId` FROM `accounts` WHERE `accountNumber` = '4199' LIMIT 1),
  1200.00,
  'Sales on account (simplified)'
);

-- =============================================================================
-- Login passwords (if still plain per class seed): 1234
-- After running: refresh the home page; dashboard calls /reports/ratios and
-- /journal/entries?status=PENDING
-- =============================================================================
