-- Migration 005: Add users table for multi-user authentication
-- This replaces the single-user env var auth with a proper user management system

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    initials VARCHAR(10) NOT NULL,
    bar_number VARCHAR(50),
    position VARCHAR(50) NOT NULL,  -- 'attorney', 'paralegal', 'manager'
    is_admin BOOLEAN DEFAULT FALSE,
    must_change_password BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- Seed first admin user (Cooper Mayne)
-- Password: changeme (bcrypt hash with cost factor 12)
INSERT INTO users (email, password_hash, first_name, last_name, initials, bar_number, position, is_admin, must_change_password)
VALUES (
    'cmayne@example.com',
    '$2b$12$bEM7.3oceAmU4w34f0VSdurpgVMT1z.pQP3DiwJ192m8d7M1x876u',
    'Cooper',
    'Mayne',
    'CM',
    '343691',
    'attorney',
    TRUE,
    TRUE
)
ON CONFLICT (email) DO NOTHING;
