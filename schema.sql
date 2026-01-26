-- Galipo Database Schema
-- This file can recreate the entire database structure from scratch.
-- Run with: psql $DATABASE_URL -f schema.sql

-- Drop existing tables (in correct order due to foreign keys)
DROP TABLE IF EXISTS operation_log CASCADE;
DROP TABLE IF EXISTS notes CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS activities CASCADE;
DROP TABLE IF EXISTS judges CASCADE;
DROP TABLE IF EXISTS proceedings CASCADE;
DROP TABLE IF EXISTS case_persons CASCADE;
DROP TABLE IF EXISTS expertise_types CASCADE;
DROP TABLE IF EXISTS person_types CASCADE;
DROP TABLE IF EXISTS persons CASCADE;
DROP TABLE IF EXISTS cases CASCADE;
DROP TABLE IF EXISTS jurisdictions CASCADE;

-- 1. Jurisdictions table (must be created before cases for FK)
CREATE TABLE jurisdictions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    local_rules_link TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Cases table
CREATE TABLE cases (
    id SERIAL PRIMARY KEY,
    case_name VARCHAR(255) NOT NULL,
    short_name VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'Signing Up',
    print_code VARCHAR(50),
    case_summary TEXT,
    result TEXT,
    date_of_injury DATE,
    case_numbers JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Persons table (unified person entity)
CREATE TABLE persons (
    id SERIAL PRIMARY KEY,
    person_type VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    phones JSONB DEFAULT '[]',
    emails JSONB DEFAULT '[]',
    address TEXT,
    organization VARCHAR(255),
    attributes JSONB DEFAULT '{}',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    archived BOOLEAN DEFAULT FALSE
);

-- 4. Person types table (extendable enum)
CREATE TABLE person_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Expertise types table (extendable enum for experts)
CREATE TABLE expertise_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Case persons junction table
CREATE TABLE case_persons (
    id SERIAL PRIMARY KEY,
    case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
    person_id INTEGER REFERENCES persons(id) ON DELETE CASCADE,
    role VARCHAR(100) NOT NULL,
    side VARCHAR(20),
    case_attributes JSONB DEFAULT '{}',
    case_notes TEXT,
    is_primary BOOLEAN DEFAULT FALSE,
    contact_via_person_id INTEGER REFERENCES persons(id),
    assigned_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(case_id, person_id, role)
);

-- 7. Activities table
CREATE TABLE activities (
    id SERIAL PRIMARY KEY,
    case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    description TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    minutes INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Events table (calendar events: hearings, depositions, filing deadlines, etc.)
CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    time TIME,
    location VARCHAR(255),
    description TEXT NOT NULL,
    document_link TEXT,
    calculation_note TEXT,
    starred BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. Tasks table
CREATE TABLE tasks (
    id SERIAL PRIMARY KEY,
    case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
    event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
    due_date DATE,
    completion_date DATE,
    description TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Pending',
    urgency INTEGER CHECK (urgency >= 1 AND urgency <= 4) DEFAULT 2,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. Notes table
CREATE TABLE notes (
    id SERIAL PRIMARY KEY,
    case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. Proceedings table (court filings within a case)
CREATE TABLE proceedings (
    id SERIAL PRIMARY KEY,
    case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
    case_number VARCHAR(100) NOT NULL,
    jurisdiction_id INTEGER REFERENCES jurisdictions(id),
    sort_order INTEGER DEFAULT 0,
    is_primary BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 12. Judges table (judges assigned to proceedings)
CREATE TABLE judges (
    id SERIAL PRIMARY KEY,
    proceeding_id INTEGER NOT NULL REFERENCES proceedings(id) ON DELETE CASCADE,
    person_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'Judge',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(proceeding_id, person_id)
);

-- 13. Operation log table (for AI mutation rollback capability)
CREATE TABLE operation_log (
    id SERIAL PRIMARY KEY,
    session_id UUID NOT NULL,
    sequence INT NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    operation VARCHAR(10) NOT NULL,  -- INSERT, UPDATE, DELETE
    record_id INT,
    before_data JSONB,
    after_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    rolled_back_at TIMESTAMP
);

-- Indexes for better query performance
CREATE INDEX idx_cases_status ON cases(status);
CREATE INDEX idx_persons_name ON persons(name);
CREATE INDEX idx_persons_type ON persons(person_type);
CREATE INDEX idx_persons_archived ON persons(archived);
CREATE INDEX idx_persons_attributes ON persons USING GIN (attributes);
CREATE INDEX idx_case_persons_case_id ON case_persons(case_id);
CREATE INDEX idx_case_persons_person_id ON case_persons(person_id);
CREATE INDEX idx_case_persons_role ON case_persons(role);
CREATE INDEX idx_tasks_case_id ON tasks(case_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_sort_order ON tasks(sort_order);
CREATE INDEX idx_events_case_id ON events(case_id);
CREATE INDEX idx_events_date ON events(date);
CREATE INDEX idx_activities_case_id ON activities(case_id);
CREATE INDEX idx_notes_case_id ON notes(case_id);
CREATE INDEX idx_proceedings_case_id ON proceedings(case_id);
CREATE INDEX idx_judges_proceeding_id ON judges(proceeding_id);
CREATE INDEX idx_judges_person_id ON judges(person_id);
CREATE INDEX idx_operation_log_session ON operation_log(session_id);
CREATE INDEX idx_operation_log_created ON operation_log(created_at DESC);
CREATE INDEX idx_operation_log_table ON operation_log(table_name);
