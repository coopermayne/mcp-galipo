-- Migration: Add webhook_logs table for storing incoming webhooks
-- Date: 2026-01-27
-- Description: Creates a table to store incoming webhook events from external services
--              (e.g., CourtListener) for later processing. Includes idempotency support.

-- Create the webhook_logs table
CREATE TABLE IF NOT EXISTS webhook_logs (
    id SERIAL PRIMARY KEY,
    source VARCHAR(50) NOT NULL,                    -- "courtlistener"
    event_type VARCHAR(100),                        -- Event type from webhook provider
    idempotency_key UUID UNIQUE,                    -- From Idempotency-Key header (prevents duplicates)
    payload JSONB NOT NULL DEFAULT '{}',            -- Full event body
    headers JSONB DEFAULT '{}',                     -- HTTP headers for debugging
    proceeding_id INTEGER REFERENCES proceedings(id) ON DELETE SET NULL,  -- Link to proceeding
    task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,              -- Created task (if any)
    event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,            -- Created event (if any)
    processing_status VARCHAR(20) NOT NULL DEFAULT 'pending',             -- pending, processing, completed, failed
    processing_error TEXT,                          -- Error message if processing failed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP                          -- When processing completed
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_webhook_logs_source ON webhook_logs(source);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status ON webhook_logs(processing_status);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON webhook_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_proceeding_id ON webhook_logs(proceeding_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_idempotency_key ON webhook_logs(idempotency_key);
