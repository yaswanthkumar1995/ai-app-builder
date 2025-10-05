-- Migration to enforce non-null unique usernames
USE ai_platform;

-- Backfill missing usernames with ID-based placeholders
UPDATE users
SET username = CONCAT('user_', SUBSTRING(REPLACE(id, '-', ''), 1, 40))
WHERE username IS NULL OR username = '';

-- Ensure username is always present and unique
ALTER TABLE users
  MODIFY COLUMN username VARCHAR(50) NOT NULL;
