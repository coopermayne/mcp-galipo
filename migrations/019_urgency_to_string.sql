-- Migration: Change tasks.urgency from INTEGER to VARCHAR enum
-- Date: 2026-02-06
-- Description: More expressive urgency values: Low, Medium, High, Urgent

-- Drop the old CHECK constraint
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_urgency_check;

-- Convert existing integer values to strings
ALTER TABLE tasks ALTER COLUMN urgency TYPE VARCHAR(20)
    USING CASE urgency
        WHEN 1 THEN 'Low'
        WHEN 2 THEN 'Medium'
        WHEN 3 THEN 'High'
        WHEN 4 THEN 'Urgent'
        ELSE 'Medium'
    END;

-- Set new default and constraint
ALTER TABLE tasks ALTER COLUMN urgency SET DEFAULT 'Medium';
ALTER TABLE tasks ADD CONSTRAINT tasks_urgency_check
    CHECK (urgency IN ('Low', 'Medium', 'High', 'Urgent'));
