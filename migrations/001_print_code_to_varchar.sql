-- Migration: Change print_code from INTEGER to VARCHAR(50)
-- Description: print_code is used as a string everywhere (e.g., "SMJ-001")
-- but was incorrectly defined as INTEGER in the original schema.

ALTER TABLE cases ALTER COLUMN print_code TYPE VARCHAR(50) USING print_code::VARCHAR(50);
