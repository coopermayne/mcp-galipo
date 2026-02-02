-- Migration: Add color column to cases table
-- Allows cases to have a color for visual distinction in lists

ALTER TABLE cases ADD COLUMN IF NOT EXISTS color VARCHAR(20) DEFAULT NULL;

-- Assign colors to existing cases that don't have one
UPDATE cases SET color = CASE
  WHEN (id % 10) = 0 THEN 'blue'
  WHEN (id % 10) = 1 THEN 'emerald'
  WHEN (id % 10) = 2 THEN 'amber'
  WHEN (id % 10) = 3 THEN 'red'
  WHEN (id % 10) = 4 THEN 'violet'
  WHEN (id % 10) = 5 THEN 'pink'
  WHEN (id % 10) = 6 THEN 'cyan'
  WHEN (id % 10) = 7 THEN 'orange'
  WHEN (id % 10) = 8 THEN 'indigo'
  WHEN (id % 10) = 9 THEN 'teal'
END
WHERE color IS NULL;
