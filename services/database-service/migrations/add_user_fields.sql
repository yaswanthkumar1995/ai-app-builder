-- Migration to add username, firstname, lastname fields to users table
USE ai_platform;

-- Add new columns if they don't exist
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS username VARCHAR(50) UNIQUE AFTER id,
  ADD COLUMN IF NOT EXISTS firstname VARCHAR(100) AFTER username,
  ADD COLUMN IF NOT EXISTS lastname VARCHAR(100) AFTER firstname;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_email ON users(email);
