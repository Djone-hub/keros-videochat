-- ============================================
-- KEROS VIDEOCHAT - SUPABASE TABLES
-- ============================================

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
