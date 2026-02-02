-- Migration: Add CourtListener docket ID to proceedings
-- Date: 2026-02-01
-- Description: Stores the CourtListener docket ID for matching incoming webhooks
--              to proceedings. Also adds pacer_case_id for PACER format matching.

-- Add CourtListener docket ID (their internal numeric identifier)
ALTER TABLE proceedings
ADD COLUMN IF NOT EXISTS courtlistener_docket_id BIGINT;

-- Add PACER case ID (format like "gov.uscourts.cacd.980378")
ALTER TABLE proceedings
ADD COLUMN IF NOT EXISTS pacer_case_id VARCHAR(100);

-- Index for fast webhook matching
CREATE INDEX IF NOT EXISTS idx_proceedings_courtlistener_docket_id
ON proceedings(courtlistener_docket_id)
WHERE courtlistener_docket_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_proceedings_pacer_case_id
ON proceedings(pacer_case_id)
WHERE pacer_case_id IS NOT NULL;
