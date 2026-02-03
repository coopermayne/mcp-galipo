-- Migration: Drop case_numbers column from cases
-- Description: Case numbers now live exclusively in the proceedings table,
--              where they're properly linked to jurisdictions and judges.

ALTER TABLE cases DROP COLUMN IF EXISTS case_numbers;
