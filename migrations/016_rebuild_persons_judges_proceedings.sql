-- Migration: Clean rebuild of persons, roles, expertise_types, judges, proceedings
-- Date: 2026-02-06
-- Description: Drop and recreate these tables from scratch with correct constraints.
--   Data will be re-entered manually. This eliminates accumulated migration cruft.

-- Step 1: NULL out external FKs pointing into the rebuild set
UPDATE webhook_logs SET proceeding_id = NULL WHERE proceeding_id IS NOT NULL;

-- Step 2: Drop tables in FK-dependency order
DROP TABLE IF EXISTS person_roles CASCADE;
DROP TABLE IF EXISTS proceeding_judges CASCADE;
DROP TABLE IF EXISTS proceedings CASCADE;
DROP TABLE IF EXISTS judges CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS expertise_types CASCADE;
DROP TABLE IF EXISTS persons CASCADE;

-- Also drop any lingering old tables from pre-unified-roles era
DROP TABLE IF EXISTS case_persons CASCADE;
DROP TABLE IF EXISTS case_persons_backup CASCADE;
DROP TABLE IF EXISTS person_types CASCADE;
DROP TABLE IF EXISTS person_types_backup CASCADE;
DROP TABLE IF EXISTS persons_backup CASCADE;
DROP TABLE IF EXISTS judges_backup CASCADE;
DROP TABLE IF EXISTS case_clients CASCADE;
DROP TABLE IF EXISTS case_contacts CASCADE;
DROP TABLE IF EXISTS case_defendants CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS contacts CASCADE;
DROP TABLE IF EXISTS defendants CASCADE;

-- Step 3: Recreate tables with clean definitions

CREATE TABLE persons (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phones JSONB DEFAULT '[]',
    emails JSONB DEFAULT '[]',
    address TEXT,
    organization VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    archived BOOLEAN DEFAULT FALSE
);

CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL CHECK (category IN ('client', 'counsel', 'defendant', 'expert', 'mediator', 'other')),
    sort_order INTEGER DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE person_roles (
    id SERIAL PRIMARY KEY,
    person_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
    attributes JSONB DEFAULT '{}',
    notes TEXT,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    grouped_under_id INTEGER REFERENCES persons(id) ON DELETE SET NULL,
    assigned_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE expertise_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE judges (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phones JSONB DEFAULT '[]',
    emails JSONB DEFAULT '[]',
    jurisdiction_id INTEGER REFERENCES jurisdictions(id) ON DELETE SET NULL,
    chambers TEXT,
    courtroom_number VARCHAR(50),
    appointed_by VARCHAR(255),
    appointed_date DATE,
    initials VARCHAR(10),
    status VARCHAR(50) DEFAULT 'Active',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE proceedings (
    id SERIAL PRIMARY KEY,
    case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
    case_number VARCHAR(100) NOT NULL,
    jurisdiction_id INTEGER REFERENCES jurisdictions(id),
    sort_order INTEGER DEFAULT 0,
    is_primary BOOLEAN DEFAULT FALSE,
    notes TEXT,
    courtlistener_docket_id BIGINT,
    pacer_case_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE proceeding_judges (
    id SERIAL PRIMARY KEY,
    proceeding_id INTEGER NOT NULL REFERENCES proceedings(id) ON DELETE CASCADE,
    judge_id INTEGER NOT NULL REFERENCES judges(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'Judge',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(proceeding_id, judge_id)
);

-- Step 4: Re-add FK from webhook_logs to proceedings
ALTER TABLE webhook_logs
    ADD CONSTRAINT webhook_logs_proceeding_id_fkey
    FOREIGN KEY (proceeding_id) REFERENCES proceedings(id) ON DELETE SET NULL;

-- Step 5: Create indexes
CREATE INDEX idx_persons_name ON persons(name);
CREATE INDEX idx_persons_archived ON persons(archived);
CREATE INDEX idx_roles_category ON roles(category);
CREATE INDEX idx_roles_sort_order ON roles(sort_order);
CREATE INDEX idx_person_roles_person_id ON person_roles(person_id);
CREATE INDEX idx_person_roles_role_id ON person_roles(role_id);
CREATE INDEX idx_person_roles_case_id ON person_roles(case_id);
CREATE INDEX idx_person_roles_attributes ON person_roles USING GIN(attributes);
CREATE INDEX idx_judges_name ON judges(name);
CREATE INDEX idx_judges_jurisdiction_id ON judges(jurisdiction_id);
CREATE INDEX idx_judges_status ON judges(status);
CREATE INDEX idx_proceeding_judges_proceeding_id ON proceeding_judges(proceeding_id);
CREATE INDEX idx_proceeding_judges_judge_id ON proceeding_judges(judge_id);
CREATE INDEX idx_proceedings_case_id ON proceedings(case_id);
CREATE INDEX idx_proceedings_courtlistener_docket_id ON proceedings(courtlistener_docket_id) WHERE courtlistener_docket_id IS NOT NULL;
CREATE INDEX idx_proceedings_pacer_case_id ON proceedings(pacer_case_id) WHERE pacer_case_id IS NOT NULL;

-- Partial unique indexes for person_roles (case-scoped vs standalone)
CREATE UNIQUE INDEX uq_person_roles_case ON person_roles(person_id, role_id, case_id) WHERE case_id IS NOT NULL;
CREATE UNIQUE INDEX uq_person_roles_standalone ON person_roles(person_id, role_id) WHERE case_id IS NULL;

-- Step 6: Seed roles
INSERT INTO roles (name, category, sort_order, description) VALUES
    ('plaintiff', 'client', 1, 'Plaintiff in the case'),
    ('contact', 'client', 2, 'Client contact person'),
    ('guardian_ad_litem', 'client', 3, 'Guardian ad litem'),
    ('decedent', 'client', 4, 'Deceased party'),
    ('co_counsel', 'counsel', 1, 'Co-counsel working on the case'),
    ('referring_attorney', 'counsel', 2, 'Attorney who referred the case'),
    ('opposing_counsel', 'counsel', 3, 'Attorney representing opposing party'),
    ('criminal_defense_attorney', 'counsel', 4, 'Criminal defense attorney'),
    ('prosecutor', 'counsel', 5, 'Prosecutor'),
    ('public_defender', 'counsel', 6, 'Public defender'),
    ('municipality_defendant', 'defendant', 1, 'Municipal/government defendant'),
    ('individual_defendant', 'defendant', 2, 'Individual defendant'),
    ('plaintiff_expert', 'expert', 1, 'Expert witness retained by plaintiff'),
    ('defense_expert', 'expert', 2, 'Expert witness retained by defense'),
    ('mediator', 'mediator', 1, 'Neutral mediator'),
    ('lien_holder', 'other', 1, 'Lien holder'),
    ('witness', 'other', 2, 'Fact witness'),
    ('claims_adjuster', 'other', 3, 'Insurance claims adjuster'),
    ('special_needs_consultant', 'other', 4, 'Special needs consultant');

-- Step 7: Seed expertise types
INSERT INTO expertise_types (name) VALUES
    ('Accident Reconstruction'),
    ('Biomechanics'),
    ('Economics/Damages'),
    ('Engineering'),
    ('Forensic Accounting'),
    ('Human Factors'),
    ('Life Care Planning'),
    ('Medical - General'),
    ('Medical - Neurology'),
    ('Medical - Orthopedic'),
    ('Psychiatry'),
    ('Psychology'),
    ('Toxicology'),
    ('Vocational Rehabilitation');
