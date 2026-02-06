-- Migration: Ensure all required roles exist
-- Date: 2026-02-05
-- Description: Add any missing roles. Safe to run multiple times (idempotent).

-- This is a safety net in case 012 didn't create all roles.
-- Uses ON CONFLICT to avoid duplicates.

-- Category: expert
INSERT INTO roles (name, category, sort_order, description) VALUES
    ('plaintiff_expert', 'expert', 1, 'Expert witness retained by plaintiff'),
    ('defense_expert', 'expert', 2, 'Expert witness retained by defense')
ON CONFLICT (name) DO NOTHING;

-- Category: counsel
INSERT INTO roles (name, category, sort_order, description) VALUES
    ('co_counsel', 'counsel', 1, 'Co-counsel working on the case'),
    ('referring_attorney', 'counsel', 2, 'Attorney who referred the case'),
    ('opposing_counsel', 'counsel', 3, 'Attorney representing opposing party'),
    ('criminal_defense_attorney', 'counsel', 4, 'Criminal defense attorney'),
    ('prosecutor', 'counsel', 5, 'Prosecutor'),
    ('public_defender', 'counsel', 6, 'Public defender')
ON CONFLICT (name) DO NOTHING;

-- Category: mediator
INSERT INTO roles (name, category, sort_order, description) VALUES
    ('mediator', 'mediator', 1, 'Neutral mediator')
ON CONFLICT (name) DO NOTHING;

-- Category: client
INSERT INTO roles (name, category, sort_order, description) VALUES
    ('plaintiff', 'client', 1, 'Plaintiff in the case'),
    ('contact', 'client', 2, 'Client contact person'),
    ('guardian_ad_litem', 'client', 3, 'Guardian ad litem'),
    ('decedent', 'client', 4, 'Deceased party')
ON CONFLICT (name) DO NOTHING;

-- Category: defendant
INSERT INTO roles (name, category, sort_order, description) VALUES
    ('municipality_defendant', 'defendant', 1, 'Municipal/government defendant'),
    ('individual_defendant', 'defendant', 2, 'Individual defendant')
ON CONFLICT (name) DO NOTHING;

-- Category: other
INSERT INTO roles (name, category, sort_order, description) VALUES
    ('lien_holder', 'other', 1, 'Lien holder'),
    ('witness', 'other', 2, 'Fact witness'),
    ('claims_adjuster', 'other', 3, 'Insurance claims adjuster'),
    ('special_needs_consultant', 'other', 4, 'Special needs consultant')
ON CONFLICT (name) DO NOTHING;
