-- Migration: Rename proceeding_judges table to judges
-- Date: 2026-01-24
-- Description: Simplifies table name since judges only belong to proceedings anyway.
--              Also removes Judge/Magistrate Judge as assignable roles on case_persons
--              since judges should only be assigned to proceedings.

-- Step 1: Rename the table
ALTER TABLE IF EXISTS proceeding_judges RENAME TO judges;

-- Step 2: Rename the indexes
ALTER INDEX IF EXISTS idx_proceeding_judges_proceeding_id RENAME TO idx_judges_proceeding_id;
ALTER INDEX IF EXISTS idx_proceeding_judges_person_id RENAME TO idx_judges_person_id;

-- Step 3: Standardize "Magistrate" role to "Magistrate Judge" in judges table
UPDATE judges SET role = 'Magistrate Judge' WHERE role = 'Magistrate';

-- Step 4: Remove any existing case_persons entries with judge roles
-- (These should now be on the judges table via proceedings instead)
DELETE FROM case_persons WHERE role IN ('Judge', 'Magistrate Judge');
