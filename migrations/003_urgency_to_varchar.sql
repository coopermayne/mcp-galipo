-- Migration: Convert urgency column from INTEGER to VARCHAR
-- Description: The DB schema in init_db() already defines urgency as VARCHAR(20),
-- but existing databases may have urgency as INTEGER. This migrates the data.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tasks' AND column_name = 'urgency' AND data_type = 'integer'
    ) THEN
        -- Drop existing integer CHECK constraint first
        ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_urgency_check;
        -- Map existing integer values to string labels
        ALTER TABLE tasks ALTER COLUMN urgency TYPE VARCHAR(20)
            USING CASE urgency
                WHEN 4 THEN 'Urgent'
                WHEN 3 THEN 'High'
                WHEN 2 THEN 'Medium'
                ELSE 'Low'
            END;
        -- Set new default
        ALTER TABLE tasks ALTER COLUMN urgency SET DEFAULT 'Medium';
        -- Add new string CHECK constraint
        ALTER TABLE tasks ADD CONSTRAINT tasks_urgency_check
            CHECK (urgency IN ('Low', 'Medium', 'High', 'Urgent'));
    END IF;
END $$;
