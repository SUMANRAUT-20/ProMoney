-- Requires MySQL 8+ / TiDB. Use a dedicated database user; never commit passwords.
CREATE DATABASE IF NOT EXISTS promoney CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE promoney;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  display_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NULL,
  google_sub VARCHAR(255) NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id BIGINT UNSIGNED PRIMARY KEY,
  preferences_json JSON NULL,
  avatar_data_url MEDIUMTEXT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS accounts (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  kind VARCHAR(30) NOT NULL DEFAULT 'cash',
  manual_balance DECIMAL(14,2) NOT NULL DEFAULT 0,
  currency CHAR(3) NOT NULL DEFAULT 'JPY',
  ui_details JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_accounts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS categories (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(60) NOT NULL,
  kind ENUM('income','expense') NOT NULL,
  CONSTRAINT fk_categories_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_category (user_id, name, kind)
);

CREATE TABLE IF NOT EXISTS transactions (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  account_id BIGINT UNSIGNED NULL,
  to_account_id BIGINT UNSIGNED NULL,
  category_id BIGINT UNSIGNED NULL,
  kind VARCHAR(30) NOT NULL,
  title VARCHAR(150) NOT NULL,
  note VARCHAR(255) NULL,
  amount DECIMAL(14,2) NOT NULL,
  transaction_date DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_positive_amount CHECK (amount > 0),
  CONSTRAINT fk_transactions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_transactions_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL,
  CONSTRAINT fk_transactions_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  INDEX idx_transactions_user_date (user_id, transaction_date)
);

CREATE TABLE IF NOT EXISTS budgets (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  category_id BIGINT UNSIGNED NOT NULL,
  budget_month DATE NOT NULL,
  amount_limit DECIMAL(14,2) NOT NULL,
  CONSTRAINT chk_budget_limit CHECK (amount_limit > 0),
  CONSTRAINT fk_budgets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_budgets_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
  UNIQUE KEY unique_budget (user_id, category_id, budget_month)
);

CREATE TABLE IF NOT EXISTS goals (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(100) NOT NULL,
  icon VARCHAR(12) NULL,
  target_amount DECIMAL(14,2) NOT NULL,
  saved_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  monthly_plan DECIMAL(14,2) NOT NULL DEFAULT 0,
  target_date DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_goal_saved CHECK (saved_amount >= 0),
  CONSTRAINT fk_goals_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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
