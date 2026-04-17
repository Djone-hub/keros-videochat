-- ============================================
-- CLEANUP DUPLICATE ROOMS IN SUPABASE
-- ============================================

-- This SQL removes duplicate rooms with the same name
-- Keeps the room with the earliest creation date

-- Step 1: Check for duplicate rooms
SELECT name, COUNT(*) as count
FROM videochat_rooms
GROUP BY name
HAVING COUNT(*) > 1;

-- Step 2: Delete duplicates (keep earliest created)
DELETE FROM videochat_rooms
WHERE id NOT IN (
  SELECT MIN(id)
  FROM videochat_rooms
  GROUP BY name
);

-- Step 3: Verify cleanup
SELECT name, COUNT(*) as count
FROM videochat_rooms
GROUP BY name
HAVING COUNT(*) > 1;

-- Step 4: Show remaining rooms
SELECT id, name, creator, created
FROM videochat_rooms
ORDER BY created DESC;
