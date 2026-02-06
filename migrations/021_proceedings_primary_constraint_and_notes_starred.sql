-- Migration: Enforce single primary proceeding per case, add notes.starred
-- Date: 2026-02-06

-- Only one proceeding per case can be primary
CREATE UNIQUE INDEX IF NOT EXISTS uq_proceedings_primary_per_case
    ON proceedings(case_id) WHERE is_primary = TRUE;

-- Starred notes
ALTER TABLE notes ADD COLUMN IF NOT EXISTS starred BOOLEAN NOT NULL DEFAULT FALSE;
