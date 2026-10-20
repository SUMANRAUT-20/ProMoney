-- Clean Reference Seed Template for ProMoney Database
-- Joint Backend Owners: Arpan Khatiwada & Suman Raut
--
-- NOTE: All fabricated account balances (e.g., 1,080,000 JPY) have been removed.
-- Default categories should be created for an authenticated user after registration,
-- or inserted here only after user_id = 1 exists in local development.

USE promoney;

-- Example default categories template (requires an existing user with id = 1):
-- INSERT INTO categories (user_id, name, kind) VALUES
--   (1, 'Salary', 'income'),
--   (1, 'Freelance', 'income'),
--   (1, 'Housing', 'expense'),
--   (1, 'Food & Dining', 'expense'),
--   (1, 'Transportation', 'expense'),
--   (1, 'Utilities', 'expense'),
--   (1, 'Shopping', 'expense'),
--   (1, 'Entertainment', 'expense')
-- ON DUPLICATE KEY UPDATE name = VALUES(name);
