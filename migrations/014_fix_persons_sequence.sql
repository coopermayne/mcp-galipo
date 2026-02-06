-- Migration: Fix persons sequence after table recreation
-- Date: 2026-02-05
-- Description: Migration 012 created a new persons table which got a new sequence
--              (persons_id_seq1) but setval targeted the old sequence (persons_id_seq).
--              This fixes the sequence to match the actual max ID.

SELECT setval(
    pg_get_serial_sequence('persons', 'id'),
    COALESCE((SELECT MAX(id) FROM persons), 1)
);
