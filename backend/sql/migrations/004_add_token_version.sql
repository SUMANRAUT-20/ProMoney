-- Migration 004: Add token_version to users for session revocation (Phase 3)
--
-- Every issued JWT embeds `tv: user.token_version`.
-- Incrementing `users.token_version` (on password change or POST /api/auth/logout-all)
-- immediately invalidates all previously issued tokens across all devices.

USE promoney;

ALTER TABLE users
  ADD COLUMN token_version INT UNSIGNED NOT NULL DEFAULT 0;
