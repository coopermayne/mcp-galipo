-- Migration: Change cases.print_code from VARCHAR to INTEGER
-- Date: 2026-02-06
-- Description: print_code stores numeric codes, should be INTEGER not VARCHAR.

UPDATE cases SET print_code = NULL WHERE TRIM(print_code) = '' OR print_code IS NULL;
ALTER TABLE cases ALTER COLUMN print_code TYPE INTEGER USING (print_code::INTEGER);
