-- Migration: Reseed roles with new category structure
-- Date: 2026-02-05
-- Description: Clear existing roles and reseed with new categories:
--              expert, counsel, mediator, client, defendant, other

-- Clear existing assignments and roles (order matters for FK constraints)
DELETE FROM person_roles;
DELETE FROM roles;

-- Reset sequence
ALTER SEQUENCE roles_id_seq RESTART WITH 1;

-- Category: expert
INSERT INTO roles (name, category, sort_order, description) VALUES
    ('plaintiff_expert', 'expert', 1, 'Expert witness retained by plaintiff'),
    ('defense_expert', 'expert', 2, 'Expert witness retained by defense');

-- Category: counsel
INSERT INTO roles (name, category, sort_order, description) VALUES
    ('co_counsel', 'counsel', 1, 'Co-counsel working on the case'),
    ('referring_attorney', 'counsel', 2, 'Attorney who referred the case'),
    ('opposing_counsel', 'counsel', 3, 'Attorney representing opposing party');

-- Category: mediator
INSERT INTO roles (name, category, sort_order, description) VALUES
    ('mediator', 'mediator', 1, 'Neutral mediator');

-- Category: client
INSERT INTO roles (name, category, sort_order, description) VALUES
    ('guardian_ad_litem', 'client', 1, 'Guardian ad litem'),
    ('contact', 'client', 2, 'Client contact person'),
    ('plaintiff', 'client', 3, 'Plaintiff in the case');

-- Category: defendant
INSERT INTO roles (name, category, sort_order, description) VALUES
    ('municipality_defendant', 'defendant', 1, 'Municipal/government defendant'),
    ('individual_defendant', 'defendant', 2, 'Individual defendant');

-- Category: other
INSERT INTO roles (name, category, sort_order, description) VALUES
    ('lien_holder', 'other', 1, 'Lien holder'),
    ('witness', 'other', 2, 'Fact witness');
