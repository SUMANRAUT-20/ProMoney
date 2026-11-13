-- Migration 005: Layer 1 Engine & SQL Settings Persistence (Phase 2)
-- Numbering note:
--   001 & 002 were reserved in early contract docs,
--   003 is Google Sign-In (003_add_google_signin_to_users.sql),
--   004 is reserved for Phase 3 token_version (004_add_token_version.sql).
--   Phase 2 takes the next free number: 005.
--
-- Changes:
-- 1. Creates user_settings table (preferences_json + avatar_data_url) so
--    preferences, set-once Home settings, and avatars survive restarts.
-- 2. Creates bills table for scheduled bills and subscriptions.
-- 3. Widens accounts.kind to VARCHAR(30) and adds ui_details JSON NULL.
-- 4. Widens transactions.kind to VARCHAR(30) (transfers, card_payment,
--    refund, reimbursement, cashback, adjustment) and adds to_account_id
--    and note columns.

USE promoney;

CREATE TABLE IF NOT EXISTS user_settings (
  user_id BIGINT UNSIGNED PRIMARY KEY,
  preferences_json JSON NULL,
  avatar_data_url MEDIUMTEXT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bills (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  due_date DATE NOT NULL,
  category VARCHAR(60) NOT NULL DEFAULT 'Utilities',
  frequency ENUM('monthly','yearly','one_time') NOT NULL DEFAULT 'monthly',
  is_paid TINYINT(1) NOT NULL DEFAULT 0,
  notes VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_bill_amount CHECK (amount > 0),
  CONSTRAINT fk_bills_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_bills_user_due (user_id, due_date)
);

ALTER TABLE accounts
  MODIFY COLUMN kind VARCHAR(30) NOT NULL DEFAULT 'cash';

ALTER TABLE accounts
  ADD COLUMN ui_details JSON NULL;

ALTER TABLE transactions
  MODIFY COLUMN kind VARCHAR(30) NOT NULL;

ALTER TABLE transactions
  ADD COLUMN to_account_id BIGINT UNSIGNED NULL;

ALTER TABLE transactions
  ADD COLUMN note VARCHAR(255) NULL;
