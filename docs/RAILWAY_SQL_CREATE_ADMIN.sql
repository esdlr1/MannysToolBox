-- Create Super Admin User in Railway Database
-- Run this in Railway → Postgres → Data/Query tab

-- Password hash for "En220193" (bcrypt, rounds: 12)
-- Hash: $2a$12$bEC4obigA8U5XcXm9lnZj.DU0u.a.9MCyK6dKjGgQJsvTxZyatbia

-- Check if user already exists
SELECT id, email, name, role, "isApproved" 
FROM users 
WHERE email = 'enmaeladio@gmail.com';

-- Create or update Super Admin user
-- IMPORTANT: Email must be lowercase, role must be exactly 'Super Admin' (with space)
INSERT INTO users (id, email, name, password, role, "isApproved", "createdAt", "updatedAt")
VALUES (
    gen_random_uuid()::text,
    'enmaeladio@gmail.com',  -- Lowercase email (required)
    'Emmanuel Suero',
    '$2a$12$bEC4obigA8U5XcXm9lnZj.DU0u.a.9MCyK6dKjGgQJsvTxZyatbia',  -- Hash for password: En220193
    'Super Admin',  -- Exact role with space (required)
    true,
    NOW(),
    NOW()
)
ON CONFLICT (email) DO UPDATE
SET 
    email = 'enmaeladio@gmail.com',  -- Ensure lowercase
    role = 'Super Admin',  -- Exact role with space
    password = '$2a$12$bEC4obigA8U5XcXm9lnZj.DU0u.a.9MCyK6dKjGgQJsvTxZyatbia',
    "isApproved" = true,
    name = 'Emmanuel Suero',
    "updatedAt" = NOW();

-- Create profile if it doesn't exist
INSERT INTO profiles (id, "userId", "createdAt", "updatedAt")
SELECT 
    gen_random_uuid()::text,
    u.id,
    NOW(),
    NOW()
FROM users u
WHERE u.email = 'enmaeladio@gmail.com'
AND NOT EXISTS (
    SELECT 1 FROM profiles p WHERE p."userId" = u.id
);

-- Verify user was created/updated
SELECT id, email, name, role, "isApproved", "createdAt"
FROM users 
WHERE email = 'enmaeladio@gmail.com';
