-- Migration: Remove court_id from cases table
-- Date: 2026-01-22
-- Description: Court/jurisdiction is now only associated with cases through proceedings table,
--              not directly on the cases table.

-- Remove the index first
DROP INDEX IF EXISTS idx_cases_court_id;

-- Remove the court_id column from cases
ALTER TABLE cases DROP COLUMN IF EXISTS court_id;
