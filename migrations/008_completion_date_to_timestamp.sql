-- Migration: Change completion_date from DATE to TIMESTAMP
-- This allows tracking the exact time a task was completed

ALTER TABLE tasks
ALTER COLUMN completion_date TYPE TIMESTAMP WITH TIME ZONE
USING completion_date::timestamp with time zone;
