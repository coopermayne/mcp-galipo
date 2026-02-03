-- Migration 010: User Assignments
-- Adds relationships between staff users (attorneys, paralegals) and cases/events/tasks

-- Attorney's default paralegal (1:1 relationship)
ALTER TABLE users ADD COLUMN IF NOT EXISTS paralegal_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_paralegal_id ON users(paralegal_id);

-- Case staff assignments (arrays of user IDs)
ALTER TABLE cases ADD COLUMN IF NOT EXISTS attorney_ids INTEGER[] DEFAULT '{}';
ALTER TABLE cases ADD COLUMN IF NOT EXISTS paralegal_ids INTEGER[] DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_cases_attorney_ids ON cases USING GIN(attorney_ids);
CREATE INDEX IF NOT EXISTS idx_cases_paralegal_ids ON cases USING GIN(paralegal_ids);

-- Event attendees (array of user IDs)
ALTER TABLE events ADD COLUMN IF NOT EXISTS attendee_ids INTEGER[] DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_events_attendee_ids ON events USING GIN(attendee_ids);

-- Task assignee (single user)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON tasks(assignee_id);
