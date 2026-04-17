-- ============================================
-- FIX KEROS SUPERADMIN ROLE
-- ============================================
-- Execute this in Supabase SQL Editor to restore KEROS as superadmin

-- Update KEROS role to superadmin
UPDATE videochat_users SET role = 'superadmin' WHERE username = 'KEROS';

-- Verify the change
SELECT username, role FROM videochat_users WHERE username = 'KEROS';
