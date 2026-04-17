-- ============================================
-- RESET SUPABASE - COMPLETE CLEANUP
-- ============================================
-- WARNING: This will DELETE ALL data and recreate tables
-- Only run this if you want to start completely fresh

-- Drop all tables
DROP TABLE IF EXISTS videochat_vip_channels CASCADE;
DROP TABLE IF EXISTS videochat_rooms CASCADE;
DROP TABLE IF EXISTS videochat_users CASCADE;

-- ============================================
-- RECREATE TABLES
-- ============================================

-- Table: videochat_users
CREATE TABLE videochat_users (
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
CREATE INDEX idx_videochat_users_username ON videochat_users(username);
CREATE INDEX idx_videochat_users_role ON videochat_users(role);

-- Row Level Security (RLS) Policies
ALTER TABLE videochat_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "videochat_users_all_policy" ON videochat_users FOR ALL USING (true);

-- Table: videochat_rooms
CREATE TABLE videochat_rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  avatar TEXT,
  creator TEXT NOT NULL,
  created BIGINT NOT NULL,
  channels JSONB DEFAULT '{"general": {"name": "Общий", "users": []}}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Index for faster room lookups
CREATE INDEX idx_videochat_rooms_creator ON videochat_rooms(creator);
CREATE INDEX idx_videochat_rooms_created ON videochat_rooms(created DESC);

-- Row Level Security (RLS) Policies
ALTER TABLE videochat_rooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for videochat_rooms" ON videochat_rooms;
CREATE POLICY "Enable all access for videochat_rooms" ON videochat_rooms FOR ALL USING (true);

-- Table: videochat_vip_channels
CREATE TABLE videochat_vip_channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  password TEXT,
  creator TEXT NOT NULL,
  created BIGINT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Index for faster VIP channel lookups
CREATE INDEX idx_videochat_vip_channels_creator ON videochat_vip_channels(creator);
CREATE INDEX idx_videochat_vip_channels_created ON videochat_vip_channels(created DESC);

-- Row Level Security (RLS) Policies
ALTER TABLE videochat_vip_channels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for videochat_vip_channels" ON videochat_vip_channels;
CREATE POLICY "Enable all access for videochat_vip_channels" ON videochat_vip_channels FOR ALL USING (true);

-- ============================================
-- INSERT DEFAULT ADMIN USER (KEROS)
-- ============================================

-- Insert KEROS as superadmin (password: keros123)
INSERT INTO videochat_users (username, password, name, role, is_online, last_seen)
VALUES ('KEROS', 'keros123', 'KEROS', 'superadmin', false, 0)
ON CONFLICT (username) DO UPDATE SET
  role = 'superadmin',
  password = 'keros123';

-- Verify
SELECT username, role FROM videochat_users WHERE username = 'KEROS';
