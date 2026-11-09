-- Migration 003: Google Sign-In support for the users table
-- Owner: Arpan Khatiwada (Auth) — REQUIRES Suman Raut's review before merging.
--
-- Numbering note: 001 (bills, Phase 3) and 002 (ProMoney Lab, Phases 5-6) are
-- already reserved in docs/INTEGRATION_CONTRACT.md section 2.7, so Google
-- Sign-In takes the next free number, 003, even though it is built earlier.
--
-- What this changes and why:
-- 1. password_hash becomes NULLABLE — Google-created accounts have no
--    password. Password accounts are unaffected (they always store a hash).
--    Login with a password against a Google-only account simply fails the
--    password check, which is the correct behaviour.
-- 2. google_sub stores Google's stable user ID (the `sub` claim of the
--    verified ID token). It is UNIQUE so one Google identity maps to at
--    most one ProMoney account; MySQL UNIQUE allows many NULLs, so
--    password-only accounts (google_sub = NULL) do not conflict.
--
-- Run AFTER backend/sql/schema.sql, BEFORE using POST /api/auth/google:
--   mysql -u promoney_app -p promoney < backend/sql/migrations/003_add_google_signin_to_users.sql

USE promoney;

ALTER TABLE users
  MODIFY COLUMN password_hash VARCHAR(255) NULL;

ALTER TABLE users
  ADD COLUMN google_sub VARCHAR(255) NULL,
  ADD UNIQUE KEY unique_google_sub (google_sub);
