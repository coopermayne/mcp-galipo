-- Migration: Unified Roles Schema
-- Date: 2026-02-05
-- Description: Replaces person_type + case_persons with person_roles backed by roles lookup.
--              Separates judges into standalone table (not persons) linked to proceedings.
--              This is a major schema change - deploy with care.

-- ==============================================================================
-- STEP 1: Create new tables FIRST (before any drops)
-- ==============================================================================

-- 1a. Create roles lookup table (replaces person_types)
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL,     -- 'client', 'internal_team', 'opposing_team', 'third_party'
    sort_order INTEGER DEFAULT 0,      -- UI ordering within category
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_roles_category ON roles(category);
CREATE INDEX IF NOT EXISTS idx_roles_sort_order ON roles(sort_order);

-- 1b. Create standalone judges table (separate from persons system)
CREATE TABLE IF NOT EXISTS judges_new (
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
    status VARCHAR(50) DEFAULT 'Active',  -- 'Active', 'Senior', 'Retired', 'Deceased'
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_judges_new_name ON judges_new(name);
CREATE INDEX IF NOT EXISTS idx_judges_new_jurisdiction_id ON judges_new(jurisdiction_id);
CREATE INDEX IF NOT EXISTS idx_judges_new_status ON judges_new(status);

-- 1c. Create proceeding_judges junction table (links judges to proceedings)
CREATE TABLE IF NOT EXISTS proceeding_judges_new (
    id SERIAL PRIMARY KEY,
    proceeding_id INTEGER NOT NULL REFERENCES proceedings(id) ON DELETE CASCADE,
    judge_id INTEGER NOT NULL REFERENCES judges_new(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'Judge',  -- 'Judge', 'Magistrate Judge', 'Presiding', 'Panel'
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(proceeding_id, judge_id)
);

CREATE INDEX IF NOT EXISTS idx_proceeding_judges_new_proceeding_id ON proceeding_judges_new(proceeding_id);
CREATE INDEX IF NOT EXISTS idx_proceeding_judges_new_judge_id ON proceeding_judges_new(judge_id);

-- ==============================================================================
-- STEP 2: Migrate judge data from old system to new standalone judges table
-- ==============================================================================

-- Migrate judges from persons table (where they existed as person_type='judge')
-- to the new standalone judges_new table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'persons') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'persons' AND column_name = 'person_type') THEN
            INSERT INTO judges_new (name, phones, emails, notes, created_at, updated_at)
            SELECT
                p.name,
                p.phones,
                p.emails,
                p.notes,
                p.created_at,
                p.updated_at
            FROM persons p
            WHERE LOWER(p.person_type) IN ('judge', 'magistrate judge', 'magistrate')
            ON CONFLICT DO NOTHING;
        END IF;
    END IF;
END $$;

-- Migrate proceeding judge assignments from old judges table to proceeding_judges_new
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'judges') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'judges' AND column_name = 'person_id') THEN
            -- Old judges table linked to persons via person_id
            INSERT INTO proceeding_judges_new (proceeding_id, judge_id, role, sort_order, created_at)
            SELECT
                j.proceeding_id,
                jn.id,
                j.role,
                j.sort_order,
                j.created_at
            FROM judges j
            JOIN persons p ON j.person_id = p.id
            JOIN judges_new jn ON jn.name = p.name
            ON CONFLICT (proceeding_id, judge_id) DO NOTHING;
        END IF;
    END IF;
END $$;

-- ==============================================================================
-- STEP 3: Create new persons table (simplified, no person_type)
-- ==============================================================================

-- Create temporary new persons table
CREATE TABLE IF NOT EXISTS persons_new (
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

CREATE INDEX IF NOT EXISTS idx_persons_new_name ON persons_new(name);
CREATE INDEX IF NOT EXISTS idx_persons_new_archived ON persons_new(archived);

-- Migrate person data (excluding judges, which are now in judges_new)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'persons') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'persons' AND column_name = 'person_type') THEN
            INSERT INTO persons_new (id, name, phones, emails, address, organization, notes, created_at, updated_at, archived)
            SELECT
                id,
                name,
                phones,
                emails,
                address,
                organization,
                notes,
                created_at,
                updated_at,
                archived
            FROM persons
            WHERE LOWER(person_type) NOT IN ('judge', 'magistrate judge', 'magistrate')
            ON CONFLICT (id) DO NOTHING;

            -- Update sequence to match
            PERFORM setval('persons_new_id_seq', COALESCE((SELECT MAX(id) FROM persons_new), 1));
        ELSE
            -- persons table exists but no person_type (already migrated or fresh install)
            -- Copy all data
            INSERT INTO persons_new (id, name, phones, emails, address, organization, notes, created_at, updated_at, archived)
            SELECT
                id,
                name,
                phones,
                emails,
                address,
                organization,
                notes,
                created_at,
                updated_at,
                archived
            FROM persons
            ON CONFLICT (id) DO NOTHING;

            PERFORM setval('persons_new_id_seq', COALESCE((SELECT MAX(id) FROM persons_new), 1));
        END IF;
    END IF;
END $$;

-- ==============================================================================
-- STEP 4: Create person_roles junction table (replaces case_persons)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS person_roles (
    id SERIAL PRIMARY KEY,
    person_id INTEGER NOT NULL REFERENCES persons_new(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,  -- NULL = standalone identity role
    attributes JSONB DEFAULT '{}',      -- role-specific attributes
    notes TEXT,
    is_primary BOOLEAN DEFAULT FALSE,
    grouped_under_id INTEGER REFERENCES persons_new(id) ON DELETE SET NULL,
    assigned_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Partial unique indexes (PostgreSQL NULLs are distinct in UNIQUE constraints)
CREATE UNIQUE INDEX IF NOT EXISTS uq_person_roles_case
    ON person_roles(person_id, role_id, case_id) WHERE case_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_person_roles_standalone
    ON person_roles(person_id, role_id) WHERE case_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_person_roles_person_id ON person_roles(person_id);
CREATE INDEX IF NOT EXISTS idx_person_roles_role_id ON person_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_person_roles_case_id ON person_roles(case_id);
CREATE INDEX IF NOT EXISTS idx_person_roles_attributes ON person_roles USING GIN (attributes);

-- ==============================================================================
-- STEP 5: Seed roles with categories
-- ==============================================================================

-- Client category
INSERT INTO roles (name, category, sort_order, description) VALUES
    ('Client', 'client', 1, 'Primary client in the case')
ON CONFLICT (name) DO NOTHING;

-- Internal Team category
INSERT INTO roles (name, category, sort_order, description) VALUES
    ('Lead Attorney', 'internal_team', 1, 'Lead attorney handling the case'),
    ('Associate Attorney', 'internal_team', 2, 'Associate attorney assisting on the case'),
    ('Paralegal', 'internal_team', 3, 'Paralegal supporting the case'),
    ('Case Manager', 'internal_team', 4, 'Case manager coordinating the case'),
    ('Legal Assistant', 'internal_team', 5, 'Legal assistant providing support')
ON CONFLICT (name) DO NOTHING;

-- Opposing Team category
INSERT INTO roles (name, category, sort_order, description) VALUES
    ('Defense Counsel', 'opposing_team', 1, 'Attorney representing the defense'),
    ('Defendant', 'opposing_team', 2, 'Named defendant in the case'),
    ('Defense Expert', 'opposing_team', 3, 'Expert witness retained by defense')
ON CONFLICT (name) DO NOTHING;

-- Third Party category
INSERT INTO roles (name, category, sort_order, description) VALUES
    ('Plaintiff Expert', 'third_party', 1, 'Expert witness retained by plaintiff'),
    ('Medical Provider', 'third_party', 2, 'Treating physician or medical facility'),
    ('Witness', 'third_party', 3, 'Fact witness'),
    ('Insurance Adjuster', 'third_party', 4, 'Insurance company representative'),
    ('Court Reporter', 'third_party', 5, 'Court reporter for depositions'),
    ('Process Server', 'third_party', 6, 'Process server for legal documents'),
    ('Mediator', 'third_party', 7, 'Neutral mediator'),
    ('Arbitrator', 'third_party', 8, 'Neutral arbitrator')
ON CONFLICT (name) DO NOTHING;

-- ==============================================================================
-- STEP 6: Migrate case_persons data to person_roles
-- ==============================================================================

-- Create a temporary mapping table for role name -> role_id
-- This handles cases where case_persons.role doesn't exactly match roles.name
DO $$
DECLARE
    rec RECORD;
    target_role_id INTEGER;
    role_name_normalized VARCHAR(100);
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'case_persons') THEN
        FOR rec IN SELECT DISTINCT cp.person_id, cp.case_id, cp.role, cp.case_attributes, cp.case_notes, cp.is_primary, cp.grouped_under_id, cp.assigned_date, cp.created_at
                   FROM case_persons cp
                   JOIN persons_new pn ON cp.person_id = pn.id
        LOOP
            -- Normalize role name to match seeded roles
            role_name_normalized := CASE
                WHEN rec.role ILIKE '%client%' THEN 'Client'
                WHEN rec.role ILIKE '%lead%attorney%' THEN 'Lead Attorney'
                WHEN rec.role ILIKE '%associate%attorney%' THEN 'Associate Attorney'
                WHEN rec.role ILIKE '%paralegal%' THEN 'Paralegal'
                WHEN rec.role ILIKE '%case%manager%' THEN 'Case Manager'
                WHEN rec.role ILIKE '%legal%assistant%' THEN 'Legal Assistant'
                WHEN rec.role ILIKE '%defense%counsel%' OR rec.role ILIKE '%opposing%counsel%' THEN 'Defense Counsel'
                WHEN rec.role ILIKE '%defendant%' THEN 'Defendant'
                WHEN rec.role ILIKE '%defense%expert%' THEN 'Defense Expert'
                WHEN rec.role ILIKE '%plaintiff%expert%' OR rec.role ILIKE '%expert%plaintiff%' THEN 'Plaintiff Expert'
                WHEN rec.role ILIKE '%medical%provider%' OR rec.role ILIKE '%treating%' OR rec.role ILIKE '%doctor%' OR rec.role ILIKE '%physician%' THEN 'Medical Provider'
                WHEN rec.role ILIKE '%witness%' THEN 'Witness'
                WHEN rec.role ILIKE '%insurance%' OR rec.role ILIKE '%adjuster%' THEN 'Insurance Adjuster'
                WHEN rec.role ILIKE '%court%reporter%' THEN 'Court Reporter'
                WHEN rec.role ILIKE '%process%server%' THEN 'Process Server'
                WHEN rec.role ILIKE '%mediator%' THEN 'Mediator'
                WHEN rec.role ILIKE '%arbitrator%' THEN 'Arbitrator'
                WHEN rec.role ILIKE '%expert%' THEN 'Plaintiff Expert'  -- Default unknown experts to plaintiff
                WHEN rec.role ILIKE '%attorney%' OR rec.role ILIKE '%counsel%' THEN 'Defense Counsel'  -- Default unknown counsel to defense
                ELSE 'Client'  -- Ultimate fallback
            END;

            -- Get the role_id
            SELECT id INTO target_role_id FROM roles WHERE name = role_name_normalized;

            -- Insert if not exists
            IF target_role_id IS NOT NULL THEN
                INSERT INTO person_roles (person_id, role_id, case_id, attributes, notes, is_primary, grouped_under_id, assigned_date, created_at)
                VALUES (rec.person_id, target_role_id, rec.case_id, COALESCE(rec.case_attributes, '{}'), rec.case_notes, rec.is_primary, rec.grouped_under_id, rec.assigned_date, rec.created_at)
                ON CONFLICT DO NOTHING;
            END IF;
        END LOOP;
    END IF;
END $$;

-- Also migrate standalone persons (those not in any case) based on their person_type
DO $$
DECLARE
    rec RECORD;
    target_role_id INTEGER;
    role_name_normalized VARCHAR(100);
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'persons' AND column_name = 'person_type') THEN
        FOR rec IN SELECT pn.id as person_id, p.person_type, p.attributes
                   FROM persons p
                   JOIN persons_new pn ON p.id = pn.id
                   WHERE LOWER(p.person_type) NOT IN ('judge', 'magistrate judge', 'magistrate')
                   AND NOT EXISTS (SELECT 1 FROM person_roles pr WHERE pr.person_id = pn.id AND pr.case_id IS NULL)
        LOOP
            -- Map person_type to a role
            role_name_normalized := CASE
                WHEN rec.person_type ILIKE '%client%' THEN 'Client'
                WHEN rec.person_type ILIKE '%attorney%' OR rec.person_type ILIKE '%counsel%' THEN 'Lead Attorney'
                WHEN rec.person_type ILIKE '%paralegal%' THEN 'Paralegal'
                WHEN rec.person_type ILIKE '%defendant%' THEN 'Defendant'
                WHEN rec.person_type ILIKE '%expert%' THEN 'Plaintiff Expert'
                WHEN rec.person_type ILIKE '%medical%' OR rec.person_type ILIKE '%provider%' OR rec.person_type ILIKE '%doctor%' THEN 'Medical Provider'
                WHEN rec.person_type ILIKE '%witness%' THEN 'Witness'
                WHEN rec.person_type ILIKE '%insurance%' THEN 'Insurance Adjuster'
                WHEN rec.person_type ILIKE '%mediator%' THEN 'Mediator'
                WHEN rec.person_type ILIKE '%arbitrator%' THEN 'Arbitrator'
                ELSE 'Client'  -- Default fallback for unknown types
            END;

            SELECT id INTO target_role_id FROM roles WHERE name = role_name_normalized;

            IF target_role_id IS NOT NULL THEN
                INSERT INTO person_roles (person_id, role_id, case_id, attributes, created_at)
                VALUES (rec.person_id, target_role_id, NULL, COALESCE(rec.attributes, '{}'), CURRENT_TIMESTAMP)
                ON CONFLICT DO NOTHING;
            END IF;
        END LOOP;
    END IF;
END $$;

-- ==============================================================================
-- STEP 7: Drop old tables in correct FK order
-- ==============================================================================

-- Drop old judges junction table (references persons, proceedings)
DROP TABLE IF EXISTS judges CASCADE;

-- Drop case_persons (references persons, cases)
DROP TABLE IF EXISTS case_persons CASCADE;

-- Drop person_types lookup table (no FKs, but was related to persons)
DROP TABLE IF EXISTS person_types CASCADE;

-- Drop expertise_types (similar cleanup)
-- Note: keeping this as it may be used elsewhere
-- DROP TABLE IF EXISTS expertise_types CASCADE;

-- Drop old persons table
DROP TABLE IF EXISTS persons CASCADE;

-- ==============================================================================
-- STEP 8: Rename new tables to final names
-- ==============================================================================

-- Rename persons_new to persons
ALTER TABLE IF EXISTS persons_new RENAME TO persons;
ALTER INDEX IF EXISTS idx_persons_new_name RENAME TO idx_persons_name;
ALTER INDEX IF EXISTS idx_persons_new_archived RENAME TO idx_persons_archived;
ALTER SEQUENCE IF EXISTS persons_new_id_seq RENAME TO persons_id_seq;

-- Rename judges_new to judges
ALTER TABLE IF EXISTS judges_new RENAME TO judges;
ALTER INDEX IF EXISTS idx_judges_new_name RENAME TO idx_judges_name;
ALTER INDEX IF EXISTS idx_judges_new_jurisdiction_id RENAME TO idx_judges_jurisdiction_id;
ALTER INDEX IF EXISTS idx_judges_new_status RENAME TO idx_judges_status;
ALTER SEQUENCE IF EXISTS judges_new_id_seq RENAME TO judges_id_seq;

-- Rename proceeding_judges_new to proceeding_judges
ALTER TABLE IF EXISTS proceeding_judges_new RENAME TO proceeding_judges;
ALTER INDEX IF EXISTS idx_proceeding_judges_new_proceeding_id RENAME TO idx_proceeding_judges_proceeding_id;
ALTER INDEX IF EXISTS idx_proceeding_judges_new_judge_id RENAME TO idx_proceeding_judges_judge_id;
ALTER SEQUENCE IF EXISTS proceeding_judges_new_id_seq RENAME TO proceeding_judges_id_seq;

-- Update foreign key references in person_roles to point to renamed persons table
-- (The FK was created pointing to persons_new, which is now persons - PostgreSQL handles this automatically during rename)

-- ==============================================================================
-- STEP 9: Recreate any views or other dependent objects if needed
-- ==============================================================================

-- No views to recreate in current schema

-- ==============================================================================
-- DONE: Summary of changes
-- ==============================================================================

-- Created tables:
--   - roles (lookup table with categories)
--   - judges (standalone, no longer linked to persons)
--   - proceeding_judges (links judges to proceedings)
--   - persons (simplified, no person_type column)
--   - person_roles (replaces case_persons)

-- Dropped tables:
--   - judges (old junction table linking persons to proceedings)
--   - case_persons
--   - person_types
--   - persons (old, with person_type column)

-- Seeded roles:
--   - Client category: Client
--   - Internal Team: Lead Attorney, Associate Attorney, Paralegal, Case Manager, Legal Assistant
--   - Opposing Team: Defense Counsel, Defendant, Defense Expert
--   - Third Party: Plaintiff Expert, Medical Provider, Witness, Insurance Adjuster, Court Reporter, Process Server, Mediator, Arbitrator
