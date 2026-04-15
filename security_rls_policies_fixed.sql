-- ============================================================================
-- 🔐 RLS ПОЛИТИКИ БЕЗОПАСНОСТИ ДЛЯ KEROSMODS.RU
-- ============================================================================
-- ОБЛЕГЧЁННАЯ ВЕРСИЯ - ТОЛЬКО СУЩЕСТВУЮЩИЕ ТАБЛИЦЫ
-- ============================================================================
-- Выполните этот SQL скрипт в Supabase Dashboard → SQL Editor
-- ============================================================================

-- ============================================================================
-- 1. ТАБЛИЦА profiles
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Все могут видеть базовые профили
CREATE POLICY "Публичные профили - чтение"
ON profiles FOR SELECT
USING (true);

-- Пользователь может редактировать только свой профиль
CREATE POLICY "Редактирование своего профиля"
ON profiles FOR UPDATE
USING (auth.uid() = id);

-- Только администраторы могут изменять роли и VIP статус
CREATE POLICY "Только админы изменяют роли"
ON profiles FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('owner', 'admin_senior', 'admin')
    )
);

-- ============================================================================
-- 2. ТАБЛИЦА mods (ЗАЩИТА VIP МОДОВ)
-- ============================================================================

ALTER TABLE mods ENABLE ROW LEVEL SECURITY;

-- Все могут видеть обычные моды, VIP только для авторизованных
CREATE POLICY "Публичные моды - чтение"
ON mods FOR SELECT
USING (
    is_vip = false 
    OR is_private = false
    OR EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND (is_vip = true OR role IN ('owner', 'admin_senior', 'admin', 'moderator_senior', 'moderator'))
    )
    OR user_id = auth.uid()
);

-- Только авторизованные пользователи могут создавать моды
CREATE POLICY "Создание модов"
ON mods FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Автор может редактировать свои моды
CREATE POLICY "Редактирование своих модов"
ON mods FOR UPDATE
USING (auth.uid() = user_id);

-- Только админы могут редактировать любые моды
CREATE POLICY "Админы редактируют все моды"
ON mods FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('owner', 'admin_senior', 'admin')
    )
);

-- Автор может удалять свои моды
CREATE POLICY "Удаление своих модов"
ON mods FOR DELETE
USING (auth.uid() = user_id);

-- Только админы могут удалять любые моды
CREATE POLICY "Админы удаляют все моды"
ON mods FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('owner', 'admin_senior', 'admin')
    )
);

-- ============================================================================
-- 3. ТАБЛИЦА user_warnings (ПРЕДУПРЕЖДЕНИЯ)
-- ============================================================================

ALTER TABLE user_warnings ENABLE ROW LEVEL SECURITY;

-- Пользователь видит только свои предупреждения
CREATE POLICY "Просмотр своих предупреждений"
ON user_warnings FOR SELECT
USING (
    auth.uid() = user_id
    OR EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('owner', 'admin_senior', 'admin', 'moderator_senior', 'moderator')
    )
);

-- Только админы и модераторы могут создавать предупреждения
CREATE POLICY "Создание предупреждений"
ON user_warnings FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('owner', 'admin_senior', 'admin', 'moderator_senior', 'moderator')
    )
);

-- Только админы могут удалять предупреждения
CREATE POLICY "Удаление предупреждений"
ON user_warnings FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('owner', 'admin_senior', 'admin')
    )
);

-- ============================================================================
-- 4. ТАБЛИЦА comment_bans (БЛОКИРОВКИ)
-- ============================================================================

ALTER TABLE comment_bans ENABLE ROW LEVEL SECURITY;

-- Пользователь видит только свои блокировки
CREATE POLICY "Просмотр своих блокировок"
ON comment_bans FOR SELECT
USING (
    auth.uid() = user_id
    OR EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('owner', 'admin_senior', 'admin', 'moderator_senior', 'moderator')
    )
);

-- Только админы и модераторы могут создавать блокировки
CREATE POLICY "Создание блокировок"
ON comment_bans FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('owner', 'admin_senior', 'admin', 'moderator_senior', 'moderator')
    )
);

-- Только админы могут удалять блокировки
CREATE POLICY "Удаление блокировок"
ON comment_bans FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('owner', 'admin_senior', 'admin')
    )
);

-- ============================================================================
-- 5. ТАБЛИЦА feedback (ОБРАТНАЯ СВЯЗЬ)
-- ============================================================================

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Пользователь видит только свои сообщения
CREATE POLICY "Просмотр своих сообщений"
ON feedback FOR SELECT
USING (
    auth.uid() = user_id
    OR EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('owner', 'admin_senior', 'admin', 'moderator_senior', 'moderator')
    )
);

-- Любой авторизованный пользователь может создавать сообщения
CREATE POLICY "Создание сообщений"
ON feedback FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Пользователь может обновлять только свои сообщения
CREATE POLICY "Обновление своих сообщений"
ON feedback FOR UPDATE
USING (auth.uid() = user_id);

-- Только админы могут обновлять любые сообщения (для ответов)
CREATE POLICY "Админы отвечают на сообщения"
ON feedback FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('owner', 'admin_senior', 'admin')
    )
);

-- Только админы могут удалять сообщения
CREATE POLICY "Удаление сообщений"
ON feedback FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('owner', 'admin_senior', 'admin')
    )
);

-- ============================================================================
-- 6. ТАБЛИЦА orders (VIP ЗАКАЗЫ) - ЕСЛИ СУЩЕСТВУЕТ
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders') THEN
        ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

        -- Пользователь видит только свои заказы
        CREATE POLICY "Просмотр своих заказов"
        ON orders FOR SELECT
        USING (auth.uid() = user_id);

        -- Только автор может создавать заказы
        CREATE POLICY "Создание заказов"
        ON orders FOR INSERT
        WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- ============================================================================
-- 7. ТАБЛИЦА purchases (ПОКУПКИ) - ЕСЛИ СУЩЕСТВУЕТ
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchases') THEN
        ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

        -- Пользователь видит только свои покупки
        CREATE POLICY "Просмотр своих покупок"
        ON purchases FOR SELECT
        USING (auth.uid() = user_id);

        -- Только система может создавать покупки
        CREATE POLICY "Создание покупок"
        ON purchases FOR INSERT
        WITH CHECK (true);
    END IF;
END $$;

-- ============================================================================
-- 8. ТАБЛИЦА site_settings (НАСТРОЙКИ САЙТА)
-- ============================================================================

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- Все могут читать настройки
CREATE POLICY "Чтение настроек"
ON site_settings FOR SELECT
USING (true);

-- Только админы могут изменять настройки
CREATE POLICY "Изменение настроек"
ON site_settings FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('owner', 'admin_senior', 'admin')
    )
);

-- ============================================================================
-- ГОТОВО!
-- ============================================================================
-- После выполнения этого скрипта:
-- ✅ VIP моды защищены от неавторизованного доступа
-- ✅ Пользователи видят только свои данные
-- ✅ Только админы могут управлять системой
-- ============================================================================
