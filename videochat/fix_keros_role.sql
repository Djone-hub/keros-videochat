-- ============================================
-- CHECK AND FIX KEROS SUPERADMIN ROLE
-- ============================================
-- Execute this in Supabase SQL Editor

-- First, check current roles of all users
SELECT username, role FROM videochat_users;

-- Then update KEROS role to superadmin
UPDATE videochat_users SET role = 'superadmin' WHERE username = 'KEROS';

-- Verify the change
SELECT username, role FROM videochat_users WHERE username = 'KEROS';
