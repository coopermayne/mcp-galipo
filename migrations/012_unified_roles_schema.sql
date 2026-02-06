-- Migration: Unified Roles Schema (Safe Version)
-- Date: 2026-02-05
-- Description: Replaces person_type + case_persons with person_roles backed by roles lookup.
--              Separates judges into standalone table (not persons) linked to proceedings.
--
-- SAFETY: This migration RENAMES old tables to _backup instead of dropping them.
--         Old data is preserved until manually verified and cleaned up.

-- ==============================================================================
-- STEP 1: Create roles lookup table
-- ==============================================================================

CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL,
    sort_order INTEGER DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_roles_category ON roles(category);
CREATE INDEX IF NOT EXISTS idx_roles_sort_order ON roles(sort_order);

-- Seed roles with proper categories matching actual usage
INSERT INTO roles (name, category, sort_order, description) VALUES
    -- Client category
    ('plaintiff', 'client', 1, 'Plaintiff/client in the case'),
    ('contact', 'client', 2, 'Contact person for a party'),
    ('guardian_ad_litem', 'client', 3, 'Guardian ad litem'),
    ('decedent', 'client', 4, 'Deceased party'),

    -- Counsel category
    ('co_counsel', 'counsel', 1, 'Co-counsel on our side'),
    ('referring_attorney', 'counsel', 2, 'Attorney who referred the case'),
    ('opposing_counsel', 'counsel', 3, 'Opposing counsel'),
    ('criminal_defense_attorney', 'counsel', 4, 'Criminal defense attorney'),
    ('prosecutor', 'counsel', 5, 'Prosecutor'),
    ('public_defender', 'counsel', 6, 'Public defender'),

    -- Defendant category
    ('municipality_defendant', 'defendant', 1, 'Government/entity defendant'),
    ('individual_defendant', 'defendant', 2, 'Individual defendant'),

    -- Expert category
    ('plaintiff_expert', 'expert', 1, 'Expert retained by plaintiff'),
    ('defense_expert', 'expert', 2, 'Expert retained by defense'),

    -- Mediator category
    ('mediator', 'mediator', 1, 'Neutral mediator'),

    -- Other category
    ('lien_holder', 'other', 1, 'Lien holder'),
    ('witness', 'other', 2, 'Fact witness'),
    ('claims_adjuster', 'other', 3, 'Insurance claims adjuster'),
    ('special_needs_consultant', 'other', 4, 'Special needs consultant')
ON CONFLICT (name) DO UPDATE SET
    category = EXCLUDED.category,
    sort_order = EXCLUDED.sort_order,
    description = EXCLUDED.description;

-- ==============================================================================
-- STEP 2a: Rename old tables BEFORE creating new ones (order matters!)
-- ==============================================================================

-- Rename old judges junction table if it has person_id (old schema)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'judges' AND column_name = 'person_id') THEN
        ALTER TABLE judges RENAME TO judges_old_junction;
        RAISE NOTICE 'Renamed old judges junction table to judges_old_junction';
    END IF;
END $$;

-- Rename case_persons if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'case_persons') THEN
        ALTER TABLE case_persons RENAME TO case_persons_backup;
        RAISE NOTICE 'Renamed case_persons to case_persons_backup';
    END IF;
END $$;

-- Rename person_types if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'person_types') THEN
        ALTER TABLE person_types RENAME TO person_types_backup;
        RAISE NOTICE 'Renamed person_types to person_types_backup';
    END IF;
END $$;

-- Rename old persons table if it has person_type column (pre-migration schema)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'persons' AND column_name = 'person_type') THEN
        ALTER TABLE persons RENAME TO persons_backup;
        RAISE NOTICE 'Renamed persons to persons_backup';

        -- Create new simplified persons table
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

        -- Drop old indexes that were on the renamed table (they keep old names)
        DROP INDEX IF EXISTS idx_persons_name;
        DROP INDEX IF EXISTS idx_persons_archived;
        CREATE INDEX idx_persons_name ON persons(name);
        CREATE INDEX idx_persons_archived ON persons(archived);

        -- Migrate person data (excluding judges)
        INSERT INTO persons (id, name, phones, emails, address, organization, notes, created_at, updated_at, archived)
        SELECT id, name, phones, emails, address, organization, notes, created_at, updated_at, archived
        FROM persons_backup
        WHERE LOWER(person_type) NOT IN ('judge', 'magistrate judge', 'magistrate');

        -- Update sequence
        PERFORM setval('persons_id_seq', COALESCE((SELECT MAX(id) FROM persons), 1));

        RAISE NOTICE 'Created new persons table and migrated data';
    END IF;
END $$;

-- ==============================================================================
-- STEP 2b: Create standalone judges table
-- ==============================================================================

CREATE TABLE IF NOT EXISTS judges (
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

CREATE INDEX IF NOT EXISTS idx_judges_name ON judges(name);
CREATE INDEX IF NOT EXISTS idx_judges_jurisdiction_id ON judges(jurisdiction_id);
CREATE INDEX IF NOT EXISTS idx_judges_status ON judges(status);

-- ==============================================================================
-- STEP 3: Create proceeding_judges junction table
-- ==============================================================================

CREATE TABLE IF NOT EXISTS proceeding_judges (
    id SERIAL PRIMARY KEY,
    proceeding_id INTEGER NOT NULL REFERENCES proceedings(id) ON DELETE CASCADE,
    judge_id INTEGER NOT NULL REFERENCES judges(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'Judge',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(proceeding_id, judge_id)
);

CREATE INDEX IF NOT EXISTS idx_proceeding_judges_proceeding_id ON proceeding_judges(proceeding_id);
CREATE INDEX IF NOT EXISTS idx_proceeding_judges_judge_id ON proceeding_judges(judge_id);

-- ==============================================================================
-- STEP 4: Migrate judges from old persons_backup to new judges table
-- ==============================================================================

DO $$
BEGIN
    -- Only migrate if persons_backup exists (means we had old schema)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'persons_backup') THEN

        INSERT INTO judges (name, phones, emails, notes, created_at, updated_at)
        SELECT p.name, p.phones, p.emails, p.notes, p.created_at, p.updated_at
        FROM persons_backup p
        WHERE LOWER(p.person_type) IN ('judge', 'magistrate judge', 'magistrate')
        ON CONFLICT DO NOTHING;

        RAISE NOTICE 'Migrated judges from persons_backup table';
    END IF;
END $$;

-- Migrate proceeding judge assignments from old judges junction table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'judges_old_junction') THEN
        INSERT INTO proceeding_judges (proceeding_id, judge_id, role, sort_order, created_at)
        SELECT
            old_j.proceeding_id,
            new_j.id,
            old_j.role,
            old_j.sort_order,
            old_j.created_at
        FROM judges_old_junction old_j
        JOIN persons_backup p ON old_j.person_id = p.id
        JOIN judges new_j ON new_j.name = p.name
        ON CONFLICT (proceeding_id, judge_id) DO NOTHING;

        RAISE NOTICE 'Migrated proceeding_judges from old judges junction table';

        -- Rename to backup for preservation
        ALTER TABLE judges_old_junction RENAME TO judges_backup;
        RAISE NOTICE 'Renamed judges_old_junction to judges_backup';
    END IF;
END $$;

-- ==============================================================================
-- STEP 7: Create person_roles junction table
-- ==============================================================================

CREATE TABLE IF NOT EXISTS person_roles (
    id SERIAL PRIMARY KEY,
    person_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
    attributes JSONB DEFAULT '{}',
    notes TEXT,
    is_primary BOOLEAN DEFAULT FALSE,
    grouped_under_id INTEGER REFERENCES persons(id) ON DELETE SET NULL,
    assigned_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Partial unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS uq_person_roles_case
    ON person_roles(person_id, role_id, case_id) WHERE case_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_person_roles_standalone
    ON person_roles(person_id, role_id) WHERE case_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_person_roles_person_id ON person_roles(person_id);
CREATE INDEX IF NOT EXISTS idx_person_roles_role_id ON person_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_person_roles_case_id ON person_roles(case_id);
CREATE INDEX IF NOT EXISTS idx_person_roles_attributes ON person_roles USING GIN (attributes);

-- ==============================================================================
-- STEP 8: Migrate case_persons data to person_roles (with proper role mapping)
-- ==============================================================================

DO $$
DECLARE
    rec RECORD;
    target_role_id INTEGER;
    mapped_role_name VARCHAR(100);
    person_name TEXT;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'case_persons_backup') THEN
        FOR rec IN
            SELECT cp.person_id, cp.case_id, cp.role, cp.case_attributes, cp.case_notes,
                   cp.is_primary, cp.grouped_under_id, cp.assigned_date, cp.created_at,
                   p.name as person_name
            FROM case_persons_backup cp
            JOIN persons p ON cp.person_id = p.id
        LOOP
            person_name := rec.person_name;

            -- Map old role names to new role names
            mapped_role_name := CASE
                -- Client category
                WHEN rec.role ILIKE 'Client' THEN 'plaintiff'
                WHEN rec.role ILIKE 'Plaintiff Contact' THEN 'contact'
                WHEN rec.role ILIKE 'Contact' THEN 'contact'
                WHEN rec.role ILIKE 'GAL' THEN 'guardian_ad_litem'
                WHEN rec.role ILIKE 'Guardian Ad Litem' THEN 'guardian_ad_litem'
                WHEN rec.role ILIKE 'Decedent' THEN 'decedent'

                -- Counsel category
                WHEN rec.role ILIKE 'Co-Counsel' THEN 'co_counsel'
                WHEN rec.role ILIKE 'Opposing Counsel' THEN 'opposing_counsel'
                WHEN rec.role ILIKE 'Criminal Defense Attorney' THEN 'criminal_defense_attorney'
                WHEN rec.role ILIKE 'Prosecutor' THEN 'prosecutor'
                WHEN rec.role ILIKE 'Public Defender' THEN 'public_defender'

                -- Defendant category - check if municipality based on name
                WHEN rec.role ILIKE 'Defendant' THEN
                    CASE
                        WHEN LOWER(person_name) LIKE '%city of%'
                          OR LOWER(person_name) LIKE '%county of%'
                          OR LOWER(person_name) LIKE '%state of%'
                          OR LOWER(person_name) LIKE '%cdcr%'
                          OR LOWER(person_name) LIKE '%chp%'
                          OR LOWER(person_name) LIKE '%lapd%'
                          OR LOWER(person_name) LIKE '%highway patrol%'
                          OR LOWER(person_name) LIKE '%authority%'
                          OR LOWER(person_name) LIKE '%metro%'
                        THEN 'municipality_defendant'
                        ELSE 'individual_defendant'
                    END

                -- Expert category
                WHEN rec.role ILIKE 'Plaintiff Expert' THEN 'plaintiff_expert'
                WHEN rec.role ILIKE 'Defendant Expert' THEN 'defense_expert'
                WHEN rec.role ILIKE 'Defense Expert' THEN 'defense_expert'

                -- Mediator category
                WHEN rec.role ILIKE 'Mediator' THEN 'mediator'

                -- Other category
                WHEN rec.role ILIKE 'Witness' THEN 'witness'
                WHEN rec.role ILIKE 'Claims Adjuster' THEN 'claims_adjuster'
                WHEN rec.role ILIKE 'Special Needs Consultant' THEN 'special_needs_consultant'

                -- Fallback - log warning and skip
                ELSE NULL
            END;

            IF mapped_role_name IS NULL THEN
                RAISE NOTICE 'Unknown role "%" for person "%" - skipping', rec.role, person_name;
                CONTINUE;
            END IF;

            SELECT id INTO target_role_id FROM roles WHERE name = mapped_role_name;

            IF target_role_id IS NULL THEN
                RAISE NOTICE 'Role "%" not found in roles table', mapped_role_name;
                CONTINUE;
            END IF;

            INSERT INTO person_roles (person_id, role_id, case_id, attributes, notes,
                                       is_primary, grouped_under_id, assigned_date, created_at)
            VALUES (rec.person_id, target_role_id, rec.case_id,
                    COALESCE(rec.case_attributes, '{}'), rec.case_notes,
                    rec.is_primary, rec.grouped_under_id, rec.assigned_date, rec.created_at)
            ON CONFLICT DO NOTHING;
        END LOOP;

        RAISE NOTICE 'Migrated case_persons_backup to person_roles';
    END IF;
END $$;

-- ==============================================================================
-- SUMMARY
-- ==============================================================================
--
-- Created tables:
--   - roles (with proper categories: client, counsel, defendant, expert, mediator, other)
--   - judges (standalone, not linked to persons)
--   - proceeding_judges (links judges to proceedings)
--   - person_roles (replaces case_persons)
--   - persons (simplified, if migration was needed)
--
-- Preserved as backups:
--   - persons_backup (if had person_type column)
--   - case_persons_backup
--   - person_types_backup
--   - judges_backup (old junction table)
--
-- To verify migration and clean up backups later:
--   SELECT COUNT(*) FROM person_roles;
--   SELECT COUNT(*) FROM case_persons_backup;
--   -- If counts match, drop backups:
--   -- DROP TABLE IF EXISTS persons_backup, case_persons_backup, person_types_backup, judges_backup;
