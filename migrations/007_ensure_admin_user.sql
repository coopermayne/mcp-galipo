-- Migration 007: Ensure admin user exists with working credentials
-- This migration ensures the admin user can login

-- First ensure the table exists (idempotent)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    initials VARCHAR(10) NOT NULL,
    bar_number VARCHAR(50),
    position VARCHAR(50) NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    must_change_password BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Upsert admin user with password: galipo2026
INSERT INTO users (email, password_hash, first_name, last_name, initials, bar_number, position, is_admin, must_change_password)
VALUES (
    'cmayne@example.com',
    'REDACTED-PASSWORD-HASH',
    'Cooper',
    'Mayne',
    'CM',
    '343691',
    'attorney',
    TRUE,
    TRUE
)
ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    is_active = TRUE,
    updated_at = CURRENT_TIMESTAMP;
