-- ============================================
-- CHECK SUPABASE DATA - DIAGNOSTIC
-- ============================================

-- Check all rooms
SELECT id, name, creator, created, channels
FROM videochat_rooms
ORDER BY created DESC;

-- Check duplicate room names
SELECT name, COUNT(*) as count, STRING_AGG(id, ', ') as ids
FROM videochat_rooms
GROUP BY name
HAVING COUNT(*) > 1;

-- Check all users
SELECT username, role, is_online, last_seen, created_at
FROM videochat_users
ORDER BY created_at DESC;

-- Check VIP channels
SELECT id, name, creator, created
FROM videochat_vip_channels
ORDER BY created DESC;
