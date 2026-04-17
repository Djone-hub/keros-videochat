-- ============================================
-- KEROS VIDEOCHAT - SUPABASE TABLES
-- ============================================

-- Table: videochat_users
-- Stores user accounts and authentication data
CREATE TABLE IF NOT EXISTS videochat_users (
  username TEXT PRIMARY KEY,
  password TEXT NOT NULL,
  name TEXT,
  avatar TEXT,
  is_online BOOLEAN DEFAULT false,
  last_seen BIGINT,
  role TEXT DEFAULT 'user',
  is_muted BOOLEAN DEFAULT false,
  mute_until BIGINT DEFAULT 0,
  kicked_rooms TEXT DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Index for faster user lookups
CREATE INDEX IF NOT EXISTS idx_videochat_users_username ON videochat_users(username);
CREATE INDEX IF NOT EXISTS idx_videochat_users_role ON videochat_users(role);

-- Row Level Security (RLS) Policies
ALTER TABLE videochat_users ENABLE ROW LEVEL SECURITY;

-- Create policy for videochat_users (allows all operations for now)
DROP POLICY IF EXISTS "videochat_users_all_policy" ON videochat_users;
CREATE POLICY "videochat_users_all_policy" ON videochat_users FOR ALL USING (true);

-- Table: videochat_rooms
-- Stores room metadata and channels
CREATE TABLE IF NOT EXISTS videochat_rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  avatar TEXT,
  creator TEXT NOT NULL,
  created BIGINT NOT NULL,
  channels JSONB DEFAULT '{"general": {"name": "Общий", "users": []}}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Index for faster room lookups
CREATE INDEX IF NOT EXISTS idx_videochat_rooms_creator ON videochat_rooms(creator);
CREATE INDEX IF NOT EXISTS idx_videochat_rooms_created ON videochat_rooms(created DESC);

-- Table: videochat_vip_channels
-- Stores VIP channel configuration
CREATE TABLE IF NOT EXISTS videochat_vip_channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  password TEXT,
  creator TEXT NOT NULL,
  created BIGINT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Index for faster VIP channel lookups
CREATE INDEX IF NOT EXISTS idx_videochat_vip_channels_creator ON videochat_vip_channels(creator);
CREATE INDEX IF NOT EXISTS idx_videochat_vip_channels_created ON videochat_vip_channels(created DESC);

-- Row Level Security (RLS) Policies
ALTER TABLE videochat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE videochat_vip_channels ENABLE ROW LEVEL SECURITY;

-- Allow all operations (for now - can be restricted later)
CREATE POLICY "Enable all access for videochat_rooms" ON videochat_rooms FOR ALL USING (true);
CREATE POLICY "Enable all access for videochat_vip_channels" ON videochat_vip_channels FOR ALL USING (true);

-- ============================================
-- USER TABLE ROLE SYSTEM
-- ============================================

-- Устанавливаем KEROS как суперадмина
UPDATE videochat_users SET role = 'superadmin' WHERE username = 'KEROS';

-- Дополнительная проверка - если KEROS существует, гарантируем роль superadmin
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM videochat_users WHERE username = 'KEROS') THEN
    UPDATE videochat_users SET role = 'superadmin' WHERE username = 'KEROS';
    RAISE NOTICE 'KEROS role set to superadmin';
  ELSE
    RAISE NOTICE 'KEROS user not found';
  END IF;
END $$;
