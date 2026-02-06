-- Migration: Remove unused docket columns from tasks
-- Date: 2026-02-06
-- Description: docket_category and docket_order were from a removed Daily Docket feature.

ALTER TABLE tasks DROP COLUMN IF EXISTS docket_category;
ALTER TABLE tasks DROP COLUMN IF EXISTS docket_order;
