-- Rollback script for proceedings feature
-- Run this to revert the schema changes if something breaks
--
-- Usage: psql $DATABASE_URL -f scripts/rollback_proceedings.sql

-- Drop the proceedings table and its index
DROP TABLE IF EXISTS proceedings CASCADE;
DROP INDEX IF EXISTS idx_proceedings_case_id;

-- Verify rollback
SELECT 'Proceedings table dropped successfully' as status;
