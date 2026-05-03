-- =============================================================================
-- Demo: one chart-of-accounts row to turn Debt-to-EQUITY red on the dashboard
--
-- Dashboard rule: Debt-to-Equity is RED when value > 2.0 (see frontend RATIO_DEFS).
-- This row is a LONG-TERM liability (subcategory does NOT contain "current"), so it
-- raises TOTAL liabilities only — Current Ratio and Quick Ratio are unchanged.
--
-- Run in MySQL against database `squarescale` while the app is stopped OR refresh
-- the dashboard after running. Owner user defaults to adminBrandon if present.
--
-- Remove effect:  DELETE FROM accounts WHERE accountNumber = '2920';
-- =============================================================================

USE squarescale;

INSERT INTO `accounts` (
  `accountName`,
  `accountNumber`,
  `description`,
  `normalSide`,
  `accountCategory`,
  `accountSubcategory`,
  `initialBalance`,
  `debit`,
  `credit`,
  `balance`,
  `createdAt`,
  `userId`,
  `accountOrder`,
  `statementType`,
  `commentText`,
  `isActive`
)
SELECT
  'DEMO — Long-term notes (high leverage)',
  '2920',
  'Raises total liabilities so Debt-to-Equity exceeds 2.0 for class/video demos.',
  'Credit',
  'Liability',
  'Long-term Liabilities',
  0.00,
  0.00,
  220000.00,
  -220000.00,
  NOW(),
  COALESCE((SELECT `userID` FROM `users` WHERE `username` = 'adminBrandon' LIMIT 1), 6),
  'Z92',
  'BS',
  'Ratio demo — delete account 2920 to remove',
  1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `accounts` WHERE `accountNumber` = '2920');

-- If you already had 2920 and need a stronger red, run:
-- UPDATE accounts SET credit = 300000, balance = -300000 WHERE accountNumber = '2920';
