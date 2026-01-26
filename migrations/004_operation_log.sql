-- Migration: Create operation_log table for tracking AI mutations with rollback capability
-- This enables undo/rollback functionality for AI-driven database changes

-- Create operation_log table (idempotent)
CREATE TABLE IF NOT EXISTS operation_log (
    id SERIAL PRIMARY KEY,
    session_id UUID NOT NULL,
    sequence INT NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    operation VARCHAR(10) NOT NULL,  -- INSERT, UPDATE, DELETE
    record_id INT,
    before_data JSONB,
    after_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    rolled_back_at TIMESTAMP
);

-- Create indexes for efficient queries (idempotent)
CREATE INDEX IF NOT EXISTS idx_operation_log_session ON operation_log(session_id);
CREATE INDEX IF NOT EXISTS idx_operation_log_created ON operation_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_operation_log_table ON operation_log(table_name);
