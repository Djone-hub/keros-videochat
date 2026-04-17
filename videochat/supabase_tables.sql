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

-- ============================================
-- USER TABLE POLICIES AND ROLE SYSTEM
-- ============================================

-- Добавляем поля для системы ролей
ALTER TABLE videochat_users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- Добавляем поля для мута и кика
ALTER TABLE videochat_users ADD COLUMN IF NOT EXISTS is_muted BOOLEAN DEFAULT false;
ALTER TABLE videochat_users ADD COLUMN IF NOT EXISTS mute_until BIGINT DEFAULT 0;
ALTER TABLE videochat_users ADD COLUMN IF NOT EXISTS kicked_rooms TEXT DEFAULT '[]';

-- Обновляем существующих пользователей
UPDATE videochat_users SET role = 'user' WHERE role IS NULL;
UPDATE videochat_users SET is_muted = false WHERE is_muted IS NULL;
UPDATE videochat_users SET mute_until = 0 WHERE mute_until IS NULL;
UPDATE videochat_users SET kicked_rooms = '[]' WHERE kicked_rooms IS NULL;

-- Удаляем ВСЕ политики
DROP POLICY IF EXISTS "videochat_users_all_policy" ON videochat_users;
DROP POLICY IF EXISTS "videochat_users_select_policy" ON videochat_users;
DROP POLICY IF EXISTS "videochat_users_insert_policy" ON videochat_users;
DROP POLICY IF EXISTS "videochat_users_update_policy" ON videochat_users;
DROP POLICY IF EXISTS "videochat_users_delete_policy" ON videochat_users;

-- Создаём ОДНУ политику для ВСЕХ операций
-- Эта политика покрывает:
-- - SELECT (вход, проверка существования пользователя)
-- - INSERT (регистрация новых пользователей)
-- - UPDATE (обновление данных, статуса онлайн, мутов, киков)
-- - DELETE (удаление пользователей)
CREATE POLICY "videochat_users_all_policy" ON videochat_users FOR ALL USING (true);

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
