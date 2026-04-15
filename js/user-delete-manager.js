// Функция для удаления пользователей из Supabase Auth
// Использует правильный метод admin.deleteUser() с обходом RLS политик

/**
 * Удаляет пользователя из Supabase Auth и всех связанных таблиц
 * Использует специальную SQL функцию для обхода RLS политик
 * @param {string} userId - ID пользователя для удаления
 * @param {string} reason - Причина удаления
 * @returns {Promise<object>} - Результат операции
 */
async function deleteUserFromSupabase(userId, reason = 'Удалено администратором') {
    try {
        console.log(`🗑️ Начинаю удаление пользователя ${userId} по причине: ${reason}`);
        
        // Проверяем права доступа
        if (!window.supabase) {
            throw new Error('Supabase клиент не инициализирован');
        }
        
        // Получаем информацию о пользователе перед удалением
        const { data: user, error: userError } = await window.supabase.auth.admin.getUserById(userId);
        if (userError) {
            console.error('❌ Ошибка получения информации о пользователе:', userError);
            throw new Error('Не удалось получить информацию о пользователе');
        }
        
        const userEmail = user.user?.email || 'неизвестен';
        console.log(`👤 Найден пользователь для удаления: ${userEmail}`);
        
        // 1. Сначала удаляем из таблицы profiles (чтобы обойти RLS)
        console.log('🗑️ Удаляем профиль пользователя...');
        const { error: profileError } = await window.supabase
            .from('profiles')
            .delete()
            .eq('id', userId);
            
        if (profileError) {
            console.error('❌ Ошибка удаления профиля:', profileError);
            // Продолжаем удаление из auth даже если профиль не удален
        } else {
                    }
        
        // 2. Удаляем все моды пользователя
        console.log('🗑️ Удаляем моды пользователя...');
        const { error: modsError } = await window.supabase
            .from('mods')
            .delete()
            .eq('author_id', userId);
            
        if (modsError) {
            console.error('❌ Ошибка удаления модов:', modsError);
        } else {
            }
        
        // 3. Удаляем все сообщения пользователя
        console.log('🗑️ Удаляем сообщения пользователя...');
        const { error: messagesError } = await window.supabase
            .from('promotional_messages')
            .delete()
            .eq('user_id', userId);
            
        if (messagesError) {
            console.error('❌ Ошибка удаления сообщений:', messagesError);
        } else {
            console.log('✅ Сообщения пользователя успешно удалены');
        }
        
        // Используем RPC функцию для обхода RLS политик
        console.log('🔧 Используем RPC функцию для обхода RLS политик...');
        const { data: result, error: deleteError } = await window.supabase
            .rpc('call_delete_user_bypass', {
                user_id_to_delete: userId,
                reason: reason
            });
            
        if (deleteError) {
            console.error('❌ Ошибка удаления пользователя:', deleteError);
            throw new Error(`Ошибка удаления пользователя: ${deleteError.message}`);
        }
        
        console.log(`✅ Результат удаления:`, result);
        
        // Показываем уведомление
        if (typeof showNotification === 'function') {
            if (result.success) {
                showNotification(`✅ ${result.message}`, 'success');
            } else {
                showNotification(`❌ ${result.error}`, 'error');
            }
        }
        
        return result;
        
    } catch (error) {
        console.error('❌ Критическая ошибка при удалении пользователя:', error);
        
        // Показываем уведомление об ошибке
        if (typeof showNotification === 'function') {
            showNotification(`❌ Ошибка удаления пользователя: ${error.message}`, 'error');
        }
        
        return {
            success: false,
            error: error.message,
            message: `Не удалось удалить пользователя: ${error.message}`
        };
    }
}

/**
 * Получает список всех пользователей с их ролями
 * @returns {Promise<Array>} - Список пользователей
 */
async function getAllUsersWithRoles() {
    try {
        // Проверяем инициализацию Supabase
        if (typeof window.supabase === 'undefined') {
            throw new Error('Supabase клиент не инициализирован');
        }
        
        // Получаем всех пользователей из profiles
        const { data: profiles, error: profilesError } = await window.supabase
            .from('profiles')
            .select('id, username, email, role, is_vip, is_owner, is_banned, created_at, last_sign_in_at')
            .order('created_at', { ascending: false });
            
        if (profilesError) {
            console.error('❌ Ошибка получения профилей:', profilesError);
            throw new Error('Не удалось получить список пользователей');
        }
        
        // Получаем всех пользователей из auth.users для статуса
        const { data: authUsers, error: authError } = await window.supabase.auth.admin.listUsers();
        
        if (authError) {
            console.error('❌ Ошибка получения auth пользователей:', authError);
            throw new Error('Не удалось получить статус пользователей');
        }
        
        // Объединяем информацию
        const usersWithInfo = profiles.map(profile => {
            const authUser = authUsers.users.find(au => au.id === profile.id);
            return {
                id: profile.id,
                username: profile.username,
                email: profile.email,
                role: profile.role,
                isVip: profile.is_vip,
                isOwner: profile.is_owner,
                isBanned: profile.is_banned,
                createdAt: profile.created_at,
                lastSignIn: authUser?.last_sign_in_at || profile.last_sign_in_at,
                isActive: !!authUser, // Активен в auth.users
                emailConfirmed: authUser?.email_confirmed_at || false
            };
        });
        
        console.log(`📊 Получено пользователей: ${usersWithInfo.length}`);
        return usersWithInfo;
        
    } catch (error) {
        console.error('❌ Ошибка получения пользователей:', error);
        throw error;
    }
}

// Экспортируем функции в глобальную область
window.deleteUserFromSupabase = deleteUserFromSupabase;
window.getAllUsersWithRoles = getAllUsersWithRoles;

