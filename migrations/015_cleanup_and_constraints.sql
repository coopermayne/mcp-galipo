-- Migration: Drop backup tables and add NOT NULL / CHECK constraints
-- Date: 2026-02-06
-- Description: Clean up backup tables left by migration 012 and tighten
--   column constraints on tasks.urgency, person_roles.is_primary, and
--   roles.category.

-- 1. Drop backup tables from the unified roles migration
DROP TABLE IF EXISTS case_persons_backup CASCADE;
DROP TABLE IF EXISTS person_types_backup CASCADE;
DROP TABLE IF EXISTS persons_backup CASCADE;
DROP TABLE IF EXISTS judges_backup CASCADE;

-- 2. tasks.urgency: backfill NULLs and add NOT NULL
UPDATE tasks SET urgency = 2 WHERE urgency IS NULL;
ALTER TABLE tasks ALTER COLUMN urgency SET NOT NULL;

-- 3. person_roles.is_primary: backfill NULLs and add NOT NULL
UPDATE person_roles SET is_primary = FALSE WHERE is_primary IS NULL;
ALTER TABLE person_roles ALTER COLUMN is_primary SET NOT NULL;

-- 4. roles.category: add CHECK constraint (idempotent via IF NOT EXISTS-style guard)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage
        WHERE table_name = 'roles' AND constraint_name = 'chk_roles_category'
    ) THEN
        ALTER TABLE roles ADD CONSTRAINT chk_roles_category
            CHECK (category IN ('client', 'counsel', 'defendant', 'expert', 'mediator', 'other'));
    END IF;
END $$;
