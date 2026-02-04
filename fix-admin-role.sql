-- Fix admin role for lopez.fafutis@gmail.com
-- Run this with: psql -U postgres -d docs_mono -f fix-admin-role.sql

BEGIN;

-- Show current user
SELECT 'BEFORE:' as status, id, email, role FROM users WHERE email = 'lopez.fafutis@gmail.com';

-- Update role to ADMIN
UPDATE users
SET role = 'ADMIN',
    updated_at = NOW()
WHERE email = 'lopez.fafutis@gmail.com';

-- Show updated user
SELECT 'AFTER:' as status, id, email, role FROM users WHERE email = 'lopez.fafutis@gmail.com';

COMMIT;

-- Verify all users
SELECT id, email, role, "doctorId" FROM users ORDER BY email;
