-- Migration: Add proceeding_judges junction table for multi-judge support
-- Date: 2026-01-23
-- Description: Allows proceedings to have multiple judges (for panels, magistrate+judge combos, etc.)
--              Safely migrates existing judge_id data to new table before removing column.

-- Step 1: Create the junction table
CREATE TABLE IF NOT EXISTS proceeding_judges (
    id SERIAL PRIMARY KEY,
    proceeding_id INTEGER NOT NULL REFERENCES proceedings(id) ON DELETE CASCADE,
    person_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'Judge',  -- 'Presiding', 'Panel', 'Magistrate', 'Judge'
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(proceeding_id, person_id)
);

-- Step 2: Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_proceeding_judges_proceeding_id ON proceeding_judges(proceeding_id);
CREATE INDEX IF NOT EXISTS idx_proceeding_judges_person_id ON proceeding_judges(person_id);

-- Step 3: Migrate existing judge_id data to the new table (if column exists)
-- Only insert if judge_id is not null and the proceeding_judges record doesn't already exist
DO $$
BEGIN
    -- Only run migration if judge_id column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'proceedings' AND column_name = 'judge_id'
    ) THEN
        INSERT INTO proceeding_judges (proceeding_id, person_id, role, sort_order)
        SELECT id, judge_id, 'Judge', 0
        FROM proceedings
        WHERE judge_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM proceeding_judges pj
            WHERE pj.proceeding_id = proceedings.id
              AND pj.person_id = proceedings.judge_id
          );
    END IF;
END $$;

-- Step 4: Remove the old judge_id column from proceedings
-- This is safe because we've already migrated the data above
ALTER TABLE proceedings DROP COLUMN IF EXISTS judge_id;
