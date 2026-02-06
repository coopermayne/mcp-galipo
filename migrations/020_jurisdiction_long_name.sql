-- Migration: Add long_name column to jurisdictions
-- Date: 2026-02-06
-- Description: name is the short form (e.g. "C.D. Cal."), long_name is the
--   full name (e.g. "Central District of California").

ALTER TABLE jurisdictions ADD COLUMN IF NOT EXISTS long_name VARCHAR(255);
