// Глобальные переменные для защиты от циклических вызовов
window.updateModsForVipChangeLock = false;
window.lastVipUpdate = null;

window.showUserBans = async function() {
    // console.log('🔓 [showUserBans] НАЧАЛО ЗАГРУЗКИ БЛОКИРОВОК');
    
    // Инициализируем красивые скроллинги
    if (window.beautifulScrollbar) {
        window.beautifulScrollbar.init();
    }
    
    const contentArea = document.getElementById('admin-content-area');
    if (!contentArea) {
        console.error('❌ [showUserBans] Контейнер не найден');
        return;
    }
    
    // Показываем загрузчик
    contentArea.innerHTML = `
        <div style="color: #00ff41; padding: 20px;">
            <h4>🚫 Управление блокировками пользователей</h4>
            <p>Загрузка данных о блокировках...</p>
        </div>
    `;

    try {
        // console.log('🔓 [showUserBans] Загружаем все типы блокировок...');
        
        // Загружаем все типы блокировок
        const [commentBans, emailBans, users] = await Promise.all([
            window.supabase.from('comment_bans').select('*').order('created_at', { ascending: false }),
            window.supabase.from('profiles').select('id, username, email, is_banned, role, is_vip, vip_expires_at').eq('is_banned', true).order('updated_at', { ascending: false }),
            window.supabase.from('profiles').select('id, username, email, is_banned, role').order('username')
        ]);

        // console.log('🔓 [showUserBans] Результаты загрузки:', {
            // commentBans: commentBans,
            // emailBans: emailBans,
            // users: users
        // });

        if (commentBans.error) {
            console.error('❌ [showUserBans] Ошибка comment_bans:', commentBans.error);
            throw commentBans.error;
        }
        if (emailBans.error) {
            console.error('❌ [showUserBans] Ошибка email-блокировок:', emailBans.error);
            throw emailBans.error;
        }
        if (users.error) {
            console.error('❌ [showUserBans] Ошибка пользователей:', users.error);
            throw users.error;
        }

        // console.log('🔓 [showUserBans] Данные загружены успешно');
        // console.log('🔓 [showUserBans] comment_bans:', commentBans.data.length);
        // console.log('🔓 [showUserBans] email_bans:', emailBans.data.length);
        // console.log('🔓 [showUserBans] users:', users.data.length);

        // Фильтруем только активные блокировки комментариев
        const activeCommentBans = commentBans.data.filter(ban => ban.is_active !== false);
        // console.log('🔓 [showUserBans] Активные блокировки комментариев:', activeCommentBans.length);

        // Создаем интерфейс с двумя контейнерами
        contentArea.innerHTML = `
            <div style="color: #00ff41; class=\ scrollable\">
                <h4 style="margin-bottom: 20px;">🚫 Управление блокировками пользователей</h4>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                    <!-- Контейнер 1: Блокировки по комментариям -->
                    <div style="background: rgba(244, 67, 54, 0.1); border: 2px solid rgba(244, 67, 54, 0.3); border-radius: 15px; padding: 15px;">
                        <h5 style="color: #ff6b6b; margin-top: 0; margin-bottom: 15px; display: flex; align-items: center; gap: 8px;">
                            💬 Блокировки по комментариям
                            <span style="background: rgba(244, 67, 54, 0.2); color: #ff6b6b; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">
                                ${activeCommentBans.length}
                            </span>
                        </h5>
                        
                        <div style="margin-bottom: 15px;">
                            <button onclick="window.banUserFromCommentsAdmin()" 
                                    style="background: linear-gradient(135deg, #f44336, #e91e63); color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-weight: bold;">
                                ➕ Заблокировать комментарии
                            </button>
                        </div>
                        
                        <div style="max-height: 400px; overflow-y: auto; border: 1px solid rgba(244, 67, 54, 0.2); border-radius: 8px; padding: 10px;">
                            ${activeCommentBans.length > 0 ? activeCommentBans.map(ban => `
                                <div style="background: rgba(244, 67, 54, 0.05); border: 1px solid rgba(244, 67, 54, 0.2); border-radius: 8px; padding: 10px; margin-bottom: 10px;">
                                    <div style="display: flex; justify-content: between; align-items: start; margin-bottom: 8px;">
                                        <div style="flex: 1;">
                                            <strong style="color: #ff6b6b;">ID: ${ban.user_id?.substring(0, 8)}...</strong>
                                            <div style="font-size: 0.9rem; color: #ccc; margin-top: 4px;">
                                                📅 ${new Date(ban.created_at).toLocaleDateString('ru-RU')}
                                            </div>
                                            <div style="font-size: 0.8rem; color: #999; margin-top: 2px;">
                                                ${ban.ban_type === 'permanent' ? '🔴 Постоянная' : `⏰ На ${ban.duration_days} дней`}
                                            </div>
                                        </div>
                                        <button onclick="unbanUserFromComments('${ban.user_id || ''}', '${ban.profiles?.username || 'Пользователь'}')" 
                                                style="background: #4CAF50; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">
                                            🔓 Разблокировать
                                        </button>
                                    </div>
                                    <div style="background: rgba(0,0,0,0.2); padding: 8px; border-radius: 4px; font-size: 0.9rem;">
                                        <strong>Причина:</strong> ${ban.reason}
                                    </div>
                                </div>
                            `).join('') : '<div style="text-align: center; color: #999; padding: 20px;">Нет активных блокировок комментариев</div>'}
                        </div>
                    </div>
                    
                    <!-- Контейнер 2: Блокировки по email -->
                    <div style="background: rgba(255, 152, 0, 0.1); border: 2px solid rgba(255, 152, 0, 0.3); border-radius: 15px; padding: 15px;">
                        <h5 style="color: #ffa726; margin-top: 0; margin-bottom: 15px; display: flex; align-items: center; gap: 8px;">
                            📧 Блокировки по email
                            <span style="background: rgba(255, 152, 0, 0.2); color: #ffa726; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">
                                ${emailBans.data.length}
                            </span>
                        </h5>
                        
                        <div style="margin-bottom: 15px;">
                            <button onclick="window.banUserByEmail()" 
                                    style="background: linear-gradient(135deg, #ff9800, #ff5722); color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-weight: bold;">
                                ➕ Заблокировать по email
                            </button>
                        </div>
                        
                        <div style="max-height: 400px; overflow-y: auto; border: 1px solid rgba(255, 152, 0, 0.2); border-radius: 8px; padding: 10px;">
                            ${emailBans.data.length > 0 ? emailBans.data.map(user => `
                                <div style="background: rgba(255, 152, 0, 0.05); border: 1px solid rgba(255, 152, 0, 0.2); border-radius: 8px; padding: 10px; margin-bottom: 10px;">
                                    <div style="display: flex; justify-content: between; align-items: start; margin-bottom: 8px;">
                                        <div style="flex: 1;">
                                            <strong style="color: #ffa726;">${user.username || 'Без имени'}</strong>
                                            <div style="font-size: 0.9rem; color: #ccc; margin-top: 4px;">
                                                📧 ${user.email}
                                            </div>
                                            <div style="font-size: 0.8rem; color: #999; margin-top: 2px;">
                                                🎭 Роль: ${user.role || 'user'}
                                            </div>
                                        </div>
                                        <button onclick="window.unbanEmailUser('${user.id}')" 
                                                style="background: #4CAF50; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">
                                            🔓 Полностью разблокировать
                                        </button>
                                    </div>
                                </div>
                            `).join('') : '<div style="text-align: center; color: #999; padding: 20px;">Нет пользователей заблокированных по email</div>'}
                        </div>
                    </div>
                </div>
                
                <!-- Статистика -->
                <div style="background: rgba(0,255,65,0.08); border: 2px solid rgba(0,255,65,0.3); border-radius: 15px; padding: 15px;">
                    <h5 style="color: #00ff41; margin-top: 0; margin-bottom: 10px;">📊 Статистика блокировок</h5>
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px;">
                        <div style="text-align: center; padding: 10px; background: rgba(244, 67, 54, 0.1); border-radius: 8px;">
                            <div style="font-size: 1.5rem; font-weight: bold; color: #ff6b6b;">${activeCommentBans.length}</div>
                            <div style="font-size: 0.9rem; color: #ccc;">Блокировок комментариев</div>
                        </div>
                        <div style="text-align: center; padding: 10px; background: rgba(255, 152, 0, 0.1); border-radius: 8px;">
                            <div style="font-size: 1.5rem; font-weight: bold; color: #ffa726;">${emailBans.data.length}</div>
                            <div style="font-size: 0.9rem; color: #ccc;">Email блокировок</div>
                        </div>
                        <div style="text-align: center; padding: 10px; background: rgba(76, 175, 80, 0.1); border-radius: 8px;">
                            <div style="font-size: 1.5rem; font-weight: bold; color: #4CAF50;">${users.data.filter(u => !u.is_banned).length}</div>
                            <div style="font-size: 0.9rem; color: #ccc;">Активных пользователей</div>
                        </div>
                        <div style="text-align: center; padding: 10px; background: rgba(33, 150, 243, 0.1); border-radius: 8px;">
                            <div style="font-size: 1.5rem; font-weight: bold; color: #2196F3;">${users.data.length}</div>
                            <div style="font-size: 0.9rem; color: #ccc;">Всего пользователей</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // console.log('✅ [admin-panel-fixed] Интерфейс блокировок загружен');
        
    } catch (error) {
        console.error('❌ [admin-panel-fixed] Ошибка загрузки блокировок:', error);
        contentArea.innerHTML = `
            <div style="color: #f44336; padding: 20px;">
                <h4>❌ Ошибка загрузки блокировок</h4>
                <p>${error.message}</p>
                <button onclick="window.showUserBans()" style="background: #f44336; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                    🔄 Попробовать снова
                </button>
            </div>
        `;
    }
};

// Вспомогательная функция для показа уведомлений
function showNotification(message, type = 'info') {
    // Если есть глобальная функция, используем её
    if (typeof window.showNotification === 'function' && window.showNotification !== showNotification) {
        window.showNotification(message, type);
        return;
    }
    
    // Иначе создаём простое уведомление
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: bold;
        z-index: 10000;
        max-width: 300px;
        word-wrap: break-word;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    
    switch(type) {
        case 'success':
            notification.style.background = 'linear-gradient(135deg, #4CAF50, #45a049)';
            break;
        case 'error':
            notification.style.background = 'linear-gradient(135deg, #f44336, #da190b)';
            break;
        case 'warning':
            notification.style.background = 'linear-gradient(135deg, #ff9800, #e68900)';
            break;
        default:
            notification.style.background = 'linear-gradient(135deg, #2196F3, #1976D2)';
    }
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Автоматически удаляем через 3 секунды
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

// Функции для управления блокировками
// Функция banUserFromComments перенесена в script.js для работы из контекста комментариев

// Функция для блокировки из админ-панели (с запросом ID)
window.banUserFromCommentsAdmin = async function() {
    const userId = prompt('Введите ID пользователя для блокировки комментариев:');
    if (!userId) return;
    
    const username = prompt('Введите имя пользователя (опционально):') || 'Пользователь';
    
    // Вызываем основную функцию из script.js
    if (typeof window.banUserFromComments === 'function') {
        await window.banUserFromComments(userId, username);
    } else {
        showNotification('❌ Функция блокировки недоступна', 'error');
    }
};

window.banUserByEmail = async function() {
    const email = prompt('Введите email пользователя для блокировки:');
    if (!email) return;
    
    const reason = prompt('Введите причину блокировки:');
    if (!reason) return;

    try {
        const { data: user, error: findError } = await window.supabase
            .from('profiles')
            .select('id, username, is_banned')
            .eq('email', email)
            .single();

        if (findError || !user) {
            showNotification('❌ Пользователь с таким email не найден', 'error');
            return;
        }

        if (user.is_banned) {
            showNotification('⚠️ Пользователь уже заблокирован', 'warning');
            return;
        }

        const { data, error: updateError } = await window.supabase
            .from('profiles')
            .update({ 
                is_banned: true,
                ban_reason: reason,
                banned_at: new Date().toISOString()
            })
            .eq('id', user.id)
            .select();

        if (updateError) throw updateError;
        if (!data || data.length === 0) throw new Error('Профиль не обновлен');

        showNotification('✅ Пользователь заблокирован по email', 'success');
        window.showUserBans();
        
    } catch (error) {
        console.error('❌ Ошибка блокировки по email:', error);
        showNotification('❌ Ошибка: ' + error.message, 'error');
    }
};

window.unbanCommentUser = async function(banId, userId) {
    // Временно включаем логи только для этой функции
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    
    // Включаем логи
    console.log = function(...args) {
        originalConsoleLog.apply(console, args);
    };
    
    console.error = function(...args) {
        originalConsoleError.apply(console, args);
    };
    
    console.log('🔓 [unbanCommentUser] НАЧАЛО РАЗБЛОКИРОВКИ КОММЕНТАРИЕВ');
    console.log('🔓 [unbanCommentUser] Параметры:', { banId, userId });
    
    if (!confirm('Разблокировать комментарии пользователя?')) {
        console.log('🔓 [unbanCommentUser] Пользователь отменил разблокировку');
        // Возвращаем оригинальные функции
        console.log = originalConsoleLog;
        console.error = originalConsoleError;
        return;
    }

    try {
        console.log('🔓 [unbanCommentUser] Проверяем Supabase доступность...');
        console.log('🔓 [unbanCommentUser] window.supabase:', !!window.supabase);
        console.log('🔓 [unbanCommentUser] window.supabase.from:', !!window.supabase?.from);
        
        if (!window.supabase) {
            throw new Error('Supabase не доступен');
        }
        
        console.log('🔓 [unbanCommentUser] Проверяем существование записи...');
        const { data: existingBan, error: checkError } = await window.supabase
            .from('comment_bans')
            .select('*')
            .eq('id', banId)
            .single();
            
        console.log('🔓 [unbanCommentUser] Существующая запись:', { data: existingBan, error: checkError });
        
        if (checkError) {
            console.error('❌ [unbanCommentUser] Ошибка проверки существующей записи:', checkError);
            throw checkError;
        }
        
        if (!existingBan) {
            console.error('❌ [unbanCommentUser] Запись не найдена, banId:', banId);
            throw new Error('Запись с ID ' + banId + ' не найдена в таблице comment_bans');
        }
        
        console.log('🔓 [unbanCommentUser] Найденная запись:', existingBan);
        console.log('🔓 [unbanCommentUser] Текущий статус is_active:', existingBan.is_active);
        
        if (!existingBan.is_active) {
            console.warn('⚠️ [unbanCommentUser] Запись уже неактивна');
            showNotification('⚠️ Эта блокировка уже неактивна', 'warning');
            // Возвращаем оригинальные функции
            console.log = originalConsoleLog;
            console.error = originalConsoleError;
            return;
        }
        
        console.log('🔓 [unbanCommentUser] Выполняем обновление...');
        
        const updateData = {
            is_active: false,
            ends_at: new Date().toISOString()
        };
        
        console.log('🔓 [unbanCommentUser] Данные для обновления:', updateData);
        
        const { data, error } = await window.supabase
            .from('comment_bans')
            .update(updateData)
            .eq('id', banId)
            .select();

        console.log('🔓 [unbanCommentUser] Результат обновления:', { data, error });

        if (error) {
            console.error('❌ [unbanCommentUser] Ошибка обновления comment_bans:', error);
            console.error('❌ [unbanCommentUser] Детали ошибки:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code
            });
            throw error;
        }

        if (!data || data.length === 0) {
            console.warn('⚠️ [unbanCommentUser] Запись не найдена или не обновлена');
            throw new Error('Запись не найдена или не обновлена');
        }

        console.log('✅ [unbanCommentUser] Успешная разблокировка:', data);
        console.log('✅ [unbanCommentUser] Обновленная запись:', data[0]);
        
        showNotification('✅ Комментарии пользователя разблокированы', 'success');
        console.log('🔓 [unbanCommentUser] Обновляем интерфейс...');
        
        // Обновляем интерфейс
        window.showUserBans();
        
    } catch (error) {
        console.error('❌ [unbanCommentUser] КРИТИЧЕСКАЯ ОШИБКА разблокировки комментариев:', error);
        console.error('❌ [unbanCommentUser] Стек ошибки:', error.stack);
        showNotification('❌ Ошибка: ' + error.message, 'error');
    }
    
    // Возвращаем оригинальные функции
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
};

window.unbanEmailUser = async function(userId) {
    console.log('🔓 [unbanEmailUser] НАЧАЛО РАЗБЛОКИРОВКИ ПО EMAIL:', { userId });
    
    if (!confirm('Разблокировать пользователя?')) {
        console.log('🔓 [unbanEmailUser] Пользователь отменил разблокировку');
        return;
    }

    try {
        console.log('🔓 [unbanEmailUser] Проверяем текущий статус пользователя...');
        
        // Проверяем что пользователь действительно заблокирован
        const { data: user, error: checkError } = await window.supabase
            .from('profiles')
            .select('id, username, is_banned')
            .eq('id', userId)
            .single();

        console.log('🔓 [unbanEmailUser] Данные пользователя:', { user, error });

        if (checkError || !user) {
            console.error('❌ [unbanEmailUser] Пользователь не найден:', checkError);
            showNotification('❌ Пользователь не найден', 'error');
            return;
        }

        if (!user.is_banned) {
            console.warn('⚠️ [unbanEmailUser] Пользователь не заблокирован');
            showNotification('⚠️ Пользователь не заблокирован', 'warning');
            return;
        }

        console.log('🔓 [unbanEmailUser] Разблокируем пользователя...');
        
        // Разблокируем пользователя
        const { data, error: updateError } = await window.supabase
            .from('profiles')
            .update({ 
                is_banned: false,
                ban_reason: null,
                banned_at: null
            })
            .eq('id', userId)
            .select();

        console.log('🔓 [unbanEmailUser] Результат обновления профиля:', { data, error: updateError });

        if (updateError) {
            console.error('❌ [unbanEmailUser] Ошибка разблокировки профиля:', updateError);
            throw updateError;
        }

        if (!data || data.length === 0) {
            throw new Error('Профиль не обновлен');
        }

        // ДОПОЛНИТЕЛЬНО: Разблокируем все активные блокировки комментариев для этого пользователя
        console.log('🔓 [unbanEmailUser] Также разблокируем все комментарии пользователя...');
        
        const { data: commentBansUpdate, error: commentBansError } = await window.supabase
            .from('comment_bans')
            .update({ 
                is_active: false,
                ends_at: new Date().toISOString()
            })
            .eq('user_id', userId)
            .eq('is_active', true)
            .select();

        console.log('🔓 [unbanEmailUser] Результат разблокировки комментариев:', { data: commentBansUpdate, error: commentBansError });

        if (commentBansError) {
            console.warn('⚠️ [unbanEmailUser] Ошибка разблокировки комментариев:', commentBansError);
            // Не прерываем основную операцию
        } else {
            console.log('✅ [unbanEmailUser] Комментарии пользователя также разблокированы:', commentBansUpdate?.length || 0);
        }

        showNotification(`✅ Пользователь ${user.username || ''} полностью разблокирован`, 'success');
        console.log('✅ [unbanEmailUser] Успешная полная разблокировка, обновляем интерфейс...');
        
        window.showUserBans();
        
    } catch (error) {
        console.error('❌ [unbanEmailUser] Ошибка разблокировки пользователя:', error);
        showNotification('❌ Ошибка: ' + error.message, 'error');
    }
};

// Функция управления блокировками пользователей
window.showUserBans = async function() {
    const contentArea = document.getElementById('admin-content-area');
    if (!contentArea) {
        console.error('❌ Контейнер admin-content-area не найден');
        return;
    }

    try {
        contentArea.innerHTML = `
            <div style="color: #f44336; class=\ scrollable\">
                <h2 style="margin-bottom: 15px; text-align: center; font-size: 1.2rem;">🚫 Управление блокировками</h2>
                
                <!-- Статистика -->
                <div style="
                    background: linear-gradient(135deg, rgba(76, 175, 80, 0.1), rgba(0, 150, 136, 0.05));
                    border: 2px solid rgba(76, 175, 80, 0.3);
                    border-radius: 10px;
                    padding: 15px;
                    margin-bottom: 15px;
                ">
                    <h3 style="color: #4CAF50; margin-bottom: 10px; font-size: 1rem;">📊 Статистика</h3>
                    <div id="bans-stats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; text-align: center;">
                        <div style="background: rgba(76, 175, 80, 0.2); padding: 10px; border-radius: 8px; position: relative;" title="Пользователи, активные за последние 5 минут">
                            <div style="font-size: 1.5rem; font-weight: bold; color: #4CAF50;" id="online-users-count">0</div>
                            <div style="font-size: 0.8rem; color: #ccc;">🟢 Онлайн</div>
                            <div style="position: absolute; top: 2px; right: 2px; font-size: 0.6rem; color: #4CAF50;">ⓘ</div>
                        </div>
                        <div style="background: rgba(244, 67, 54, 0.2); padding: 10px; border-radius: 8px;">
                            <div style="font-size: 1.5rem; font-weight: bold; color: #f44336;" id="banned-users-count">0</div>
                            <div style="font-size: 0.8rem; color: #ccc;">🚫 Забан</div>
                        </div>
                        <div style="background: rgba(255, 193, 7, 0.2); padding: 10px; border-radius: 8px;">
                            <div style="font-size: 1.5rem; font-weight: bold; color: #ffc107;" id="vip-users-count">0</div>
                            <div style="font-size: 0.8rem; color: #ccc;">💎 VIP</div>
                        </div>
                        <div style="background: rgba(255, 152, 0, 0.2); padding: 10px; border-radius: 8px;">
                            <div style="font-size: 1.5rem; font-weight: bold; color: #ff9800;" id="comment-bans-count">0</div>
                            <div style="font-size: 0.8rem; color: #ccc;">💬 Забан в комментах</div>
                        </div>
                        <div style="background: rgba(0, 204, 255, 0.2); padding: 10px; border-radius: 8px;">
                            <div style="font-size: 1.5rem; font-weight: bold; color: #00ccff;" id="total-users-count">0</div>
                            <div style="font-size: 0.8rem; color: #ccc;">📊 Всего</div>
                        </div>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">
                    
                    <!-- Контейнер: Блокировки комментариев -->
                    <div style="
                        background: linear-gradient(135deg, rgba(244, 67, 54, 0.1), rgba(255, 152, 0, 0.05));
                        border: 2px solid rgba(244, 67, 54, 0.3);
                        border-radius: 10px;
                        padding: 15px;
                        transition: all 0.3s ease;
                        cursor: pointer;
                    " onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 5px 15px rgba(244, 67, 54, 0.3)'" 
                       onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
                        
                        <div style="display: flex; align-items: center; margin-bottom: 10px;">
                            <div style="font-size: 2rem; margin-right: 10px;">💬</div>
                            <div>
                                <h3 style="color: #ff9800; margin: 0; font-size: 1rem;">Блокировки комментариев</h3>
                                <p style="color: #ccc; margin: 3px 0; font-size: 0.8rem;">Управление доступом к комментариям</p>
                            </div>
                        </div>
                        
                        <div id="comment-bans-container" style="color: #ccc;">
                            <div style="text-align: center; padding: 20px;">
                                <div style="font-size: 1.2rem; margin-bottom: 10px;">⏳</div>
                                <div>Загрузка...</div>
                            </div>
                        </div>
                        
                        <div style="margin-top: 15px;">
                            <button onclick="window.showQuickBanModal()" style="
                                background: linear-gradient(135deg, #f44336, #d32f2f);
                                color: white;
                                border: none;
                                padding: 10px 20px;
                                border-radius: 8px;
                                cursor: pointer;
                                font-weight: bold;
                                width: 100%;
                                transition: all 0.3s ease;
                            " onmouseover="this.style.background='linear-gradient(135deg, #d32f2f, #b71c1c)'" 
                               onmouseout="this.style.background='linear-gradient(135deg, #f44336, #d32f2f)'">
                                ➕ Добавить блокировку
                            </button>
                        </div>
                    </div>

                    <!-- Контейнер: Блокировки по email/нику -->
                    <div style="
                        background: linear-gradient(135deg, rgba(255, 152, 0, 0.1), rgba(255, 193, 7, 0.05));
                        border: 2px solid rgba(255, 152, 0, 0.3);
                        border-radius: 10px;
                        padding: 15px;
                        transition: all 0.3s ease;
                        cursor: pointer;
                    " onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 5px 15px rgba(255, 152, 0, 0.3)'" 
                       onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
                        
                        <div style="display: flex; align-items: center; margin-bottom: 10px;">
                            <div style="font-size: 2rem; margin-right: 10px;">🚫</div>
                            <div>
                                <h3 style="color: #ff9800; margin: 0; font-size: 1rem;">Блокировки по email/нику</h3>
                                <p style="color: #ccc; margin: 3px 0; font-size: 0.8rem;">Полный запрет доступа к сайту</p>
                            </div>
                        </div>
                        
                        <div id="email-bans-container" style="color: #ccc;">
                            <div style="text-align: center; padding: 15px;">
                                <div style="font-size: 1rem; margin-bottom: 8px;">📧</div>
                                <div>Загрузка...</div>
                            </div>
                        </div>
                        
                        <div style="margin-top: 10px;">
                            <button onclick="window.showEmailBanModal()" style="
                                background: linear-gradient(135deg, #ff9800, #f57c00);
                                color: white;
                                border: none;
                                padding: 8px 15px;
                                border-radius: 8px;
                                cursor: pointer;
                                font-weight: bold;
                                width: 100%;
                                transition: all 0.3s ease;
                            " onmouseover="this.style.background='linear-gradient(135deg, #f57c00, #ef6c00)'" 
                               onmouseout="this.style.background='linear-gradient(135deg, #ff9800, #f57c00)'">
                                ➕ Добавить блокировку
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        `;
        
        // Загружаем данные
        await window.loadBansData();
        
        // Устанавливаем автообновление статистики каждые 30 секунд
        if (window.bansStatsInterval) {
            clearInterval(window.bansStatsInterval);
        }
        window.bansStatsInterval = setInterval(async () => {
            await window.loadBansData();
            
            // Проверяем и защищаем текущего пользователя от автоматической блокировки
            const currentUser = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
            if (currentUser && currentUser.id) {
                if (typeof window.checkAndProtectFromAutoBan === 'function') {
                    await window.checkAndProtectFromAutoBan(currentUser.id);
                }
            }
        }, 30000);
        
        // Загружаем статистику пользователей
        if (typeof window.loadUserStatistics === 'function') {
            console.log('🔄 Загружаем статистику пользователей...');
            await window.loadUserStatistics();
        } else {
            console.log('⚠️ Функция loadUserStatistics не найдена');
        }
        
    } catch (error) {
        console.error('❌ Ошибка загрузки управления блокировками:', error);
        contentArea.innerHTML = `
            <div style="color: #ff4444; padding: 1rem; background: rgba(255, 68, 68, 0.1); border-radius: 5px;">
                ❌ Ошибка загрузки управления блокировками: ${error.message}
            </div>
        `;
    }
    
    // Очищаем интервал при закрытии админ панели
    const originalCloseAdmin = window.closeAdminPanel;
    window.closeAdminPanel = function() {
        if (window.bansStatsInterval) {
            clearInterval(window.bansStatsInterval);
            window.bansStatsInterval = null;
        }
        if (originalCloseAdmin) {
            originalCloseAdmin();
        }
    };
};

// Загружает данные о блокировках
window.loadBansData = async function() {
    try {
        // Загружаем блокировки комментариев
        const { data: commentBans, error: commentError } = await window.supabase
            .from('comment_bans')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (!commentError && commentBans) {
            // Получаем информацию о пользователях отдельным запросом
            const userIds = [...new Set(commentBans.map(ban => ban.user_id))];
            const { data: users } = await window.supabase
                .from('profiles')
                .select('id, username, email')
                .in('id', userIds);

            const getUserInfo = (userId) => {
                return users?.find(u => u.id === userId) || { username: 'Неизвестен', email: 'email@скрыт' };
            };

            const commentBansContainer = document.getElementById('comment-bans-container');
            if (commentBansContainer) {
                if (commentBans.length === 0) {
                    commentBansContainer.innerHTML = `
                        <div style="text-align: center; padding: 20px; color: #4CAF50;">
                            <div style="font-size: 1.2rem; margin-bottom: 10px;">✅</div>
                            <div>Нет активных блокировок</div>
                        </div>
                    `;
                } else {
                    commentBansContainer.innerHTML = `
                        <div style="font-weight: bold; margin-bottom: 10px; color: #ff9800;">${commentBans.length} блокировок</div>
                        <div style="max-height: 200px; overflow-y: auto;">
                            ${commentBans.map(ban => {
                                const createdDate = new Date(ban.created_at).toLocaleDateString('ru-RU');
                                const duration = ban.duration_days ? `${ban.duration_days} дней` : 'Навсегда';
                                const userInfo = getUserInfo(ban.user_id);
                                return `
                                    <div style="background: rgba(0,0,0,0.2); border-radius: 6px; padding: 8px; margin-bottom: 5px; font-size: 0.8rem;">
                                        <div style="display: flex; justify-content: space-between; align-items: center;">
                                            <div style="flex: 1;">
                                                <div style="color: #ff9800; font-weight: bold;">👤 ${userInfo.username}</div>
                                                <div style="color: #ccc; font-size: 0.7rem;">📧 ${userInfo.email}</div>
                                                <div style="color: #ccc; font-size: 0.7rem;">📅 ${createdDate} • ⏰ ${duration}</div>
                                            </div>
                                            <button 
                                                onclick="window.showUserBanInfo('${ban.user_id}')" 
                                                style="background: #ff9800; color: white; border: none; padding: 2px 6px; border-radius: 3px; cursor: pointer; font-size: 0.7rem; margin-left: 8px;"
                                                title="Подробности"
                                            >
                                                📋
                                            </button>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                        <button onclick="window.showDetailedCommentBans()" style="
                            background: rgba(244, 67, 54, 0.2);
                            color: #f44336;
                            border: 1px solid rgba(244, 67, 54, 0.3);
                            padding: 5px 10px;
                            border-radius: 5px;
                            cursor: pointer;
                            font-size: 0.8rem;
                            margin-top: 10px;
                            width: 100%;
                        ">
                            📋 Подробности
                        </button>
                    `;
                }
                
                // Обновляем статистику
                const commentBansCount = document.getElementById('comment-bans-count');
                if (commentBansCount) commentBansCount.textContent = commentBans.length;
            }
        } else if (commentError) {
            console.error('❌ Ошибка загрузки блокировок:', commentError);
            const commentBansContainer = document.getElementById('comment-bans-container');
            if (commentBansContainer) {
                commentBansContainer.innerHTML = `
                    <div style="text-align: center; padding: 20px; color: #f44336;">
                        <div style="font-size: 1.2rem; margin-bottom: 10px;">❌</div>
                        <div>Ошибка: ${commentError.message}</div>
                    </div>
                `;
            }
        }

        // Загружаем полностью заблокированных пользователей
        const { data: bannedUsers, error: bannedError } = await window.supabase
            .from('profiles')
            .select('id, username, email, ban_reason, banned_at')
            .eq('is_banned', true)
            .order('banned_at', { ascending: false });

        const emailBansContainer = document.getElementById('email-bans-container');
        if (emailBansContainer) {
            if (!bannedError && bannedUsers && bannedUsers.length > 0) {
                emailBansContainer.innerHTML = `
                    <div style="font-weight: bold; margin-bottom: 10px; color: #ff9800;">${bannedUsers.length} полностью заблокировано</div>
                    <div style="max-height: 200px; overflow-y: auto;">
                        ${bannedUsers.map(user => {
                            const bannedDate = user.banned_at ? new Date(user.banned_at).toLocaleDateString('ru-RU') : 'Неизвестно';
                            return `
                                <div style="background: rgba(0,0,0,0.2); border-radius: 6px; padding: 8px; margin-bottom: 5px; font-size: 0.8rem;">
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <div>
                                            <div style="color: #ff9800; font-weight: bold;">🚫 ${user.username}</div>
                                            <div style="color: #ccc; font-size: 0.7rem;">📧 ${user.email}</div>
                                            <div style="color: #ccc; font-size: 0.7rem;">📅 ${bannedDate}</div>
                                            ${user.ban_reason ? `<div style="color: #f44336; font-size: 0.7rem;">📝 ${user.ban_reason}</div>` : ''}
                                        </div>
                                        <button 
                                            onclick="window.showUserBanInfo('${user.id}')" 
                                            style="background: #ff9800; color: white; border: none; padding: 2px 6px; border-radius: 3px; cursor: pointer; font-size: 0.7rem;"
                                        >
                                            📋
                                        </button>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    <button onclick="window.showDetailedBannedUsers()" style="
                        background: rgba(255, 152, 0, 0.2);
                        color: #ff9800;
                        border: 1px solid rgba(255, 152, 0, 0.3);
                        padding: 5px 10px;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 0.8rem;
                        margin-top: 10px;
                        width: 100%;
                    ">
                        📋 Подробности
                    </button>
                `;
                
                // Обновляем статистику
                const emailBansCount = document.getElementById('email-bans-count');
                if (emailBansCount) emailBansCount.textContent = bannedUsers.length;
            } else if (bannedError) {
                console.error('❌ Ошибка загрузки заблокированных пользователей:', bannedError);
                emailBansContainer.innerHTML = `
                    <div style="text-align: center; padding: 20px; color: #f44336;">
                        <div style="font-size: 1.2rem; margin-bottom: 10px;">❌</div>
                        <div style="font-size: 0.8rem;">Ошибка загрузки: ${bannedError.message}</div>
                    </div>
                `;
                
                // Обновляем статистику
                const emailBansCount = document.getElementById('email-bans-count');
                if (emailBansCount) emailBansCount.textContent = '0';
            } else {
                emailBansContainer.innerHTML = `
                    <div style="text-align: center; padding: 20px; color: #ff9800;">
                        <div style="font-size: 1.2rem; margin-bottom: 10px;">📧</div>
                        <div style="font-size: 0.8rem;">Нет полностью заблокированных пользователей</div>
                    </div>
                `;
                
                // Обновляем статистику
                const emailBansCount = document.getElementById('email-bans-count');
                if (emailBansCount) emailBansCount.textContent = '0';
            }
        }

        // Загружаем общую статистику пользователей
        const { data: allUsers, error: usersError } = await window.supabase
            .from('profiles')
            .select('id, is_banned, is_vip, last_seen');

        if (!usersError && allUsers) {
            const onlineUsersCount = document.getElementById('online-users-count');
            const bannedUsersCount = document.getElementById('banned-users-count');
            const vipUsersCount = document.getElementById('vip-users-count');
            const totalUsersCount = document.getElementById('total-users-count');
            
            // Считаем онлайн (активные за последние 5 минут)
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
            const onlineUsers = allUsers.filter(u => u.last_seen && u.last_seen > fiveMinutesAgo).length;
            
            // Считаем забаненных
            const bannedUsers = allUsers.filter(u => u.is_banned).length;
            
            // Считаем VIP
            const vipUsers = allUsers.filter(u => u.is_vip).length;
            
            if (onlineUsersCount) onlineUsersCount.textContent = onlineUsers;
            if (bannedUsersCount) bannedUsersCount.textContent = bannedUsers;
            if (vipUsersCount) vipUsersCount.textContent = vipUsers;
            if (totalUsersCount) totalUsersCount.textContent = allUsers.length;
        }

    } catch (error) {
        console.error('❌ Ошибка загрузки данных блокировок:', error);
    }
};

// Показывает подробный список блокировок комментариев
window.showDetailedCommentBans = async function() {
    const contentArea = document.getElementById('admin-content-area');
    if (!contentArea) return;

    try {
        const { data: commentBans, error } = await window.supabase
            .from('comment_bans')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Загружаем информацию о пользователях и модераторах отдельными запросами
        const userIds = [...new Set(commentBans.map(ban => ban.user_id))];
        const moderatorIds = [...new Set(commentBans.map(ban => ban.moderator_id).filter(id => id))];

        const { data: users } = await window.supabase
            .from('profiles')
            .select('id, username, email')
            .in('id', userIds);

        const { data: moderators } = await window.supabase
            .from('profiles')
            .select('id, username, email')
            .in('id', moderatorIds);

        const getUserInfo = (id) => {
            const user = users?.find(u => u.id === id);
            return user || { username: 'Неизвестный', email: 'Неизвестен' };
        };

        const getModeratorInfo = (id) => {
            const moderator = moderators?.find(m => m.id === id);
            return moderator || { username: 'Система', email: 'auto@system' };
        };

        contentArea.innerHTML = `
            <div style="color: #f44336; class=\ scrollable\">
                <div style="display: flex; align-items: center; margin-bottom: 20px;">
                    <button onclick="window.showUserBans()" style="
                        background: rgba(244, 67, 54, 0.2);
                        color: #f44336;
                        border: 1px solid rgba(244, 67, 54, 0.3);
                        padding: 8px 15px;
                        border-radius: 8px;
                        cursor: pointer;
                        margin-right: 15px;
                        font-size: 0.9rem;
                    ">
                        ← Назад к блокировкам
                    </button>
                    <h2 style="margin: 0; font-size: 1.3rem;">🚫 Заблокированные комментарии (${commentBans?.length || 0})</h2>
                </div>

                ${!commentBans || commentBans.length === 0 ? `
                    <div style="
                        background: rgba(76, 175, 80, 0.1);
                        border: 2px solid rgba(76, 175, 80, 0.3);
                        border-radius: 15px;
                        padding: 30px;
                        text-align: center;
                        color: #4CAF50;
                    ">
                        <div style="font-size: 3rem; margin-bottom: 15px;">✅</div>
                        <div style="font-size: 1.2rem; font-weight: bold;">Черный список пуст</div>
                        <div style="color: #ccc; margin-top: 10px;">Нет активных блокировок комментариев</div>
                    </div>
                ` : `
                    <div style="display: grid; gap: 15px;">
                        ${commentBans.map(ban => {
                            const createdDate = new Date(ban.created_at).toLocaleString('ru-RU');
                            const duration = ban.duration_days ? `${ban.duration_days} дней` : 'Навсегда';
                            const endDate = ban.ends_at ? new Date(ban.ends_at).toLocaleDateString('ru-RU') : 'Никогда';
                            
                            const userInfo = getUserInfo(ban.user_id);
                            const moderatorInfo = getModeratorInfo(ban.moderator_id);
                            
                            return `
                                <div style="
                                    background: linear-gradient(135deg, rgba(244, 67, 54, 0.1), rgba(255, 152, 0, 0.05));
                                    border: 2px solid rgba(244, 67, 54, 0.3);
                                    border-radius: 15px;
                                    padding: 20px;
                                    transition: all 0.3s ease;
                                " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 5px 15px rgba(244, 67, 54, 0.2)'" 
                                   onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
                                    
                                    <div style="display: grid; grid-template-columns: auto 1fr auto; gap: 20px; align-items: start;">
                                        <!-- Информация о пользователе -->
                                        <div style="min-width: 200px;">
                                            <div style="color: #ff9800; font-weight: bold; margin-bottom: 8px;">👤 Пользователь</div>
                                            <div style="color: #fff; font-size: 1rem; margin-bottom: 4px; font-weight: bold;">
                                                ${userInfo.username}
                                            </div>
                                            <div style="color: #ccc; font-size: 0.8rem; margin-bottom: 4px;">
                                                📧 ${userInfo.email}
                                            </div>
                                            <div style="color: #888; font-size: 0.7rem;">
                                                ID: ${ban.user_id}
                                            </div>
                                        </div>
                                        
                                        <!-- Информация о блокировке -->
                                        <div>
                                            <div style="color: #f44336; font-weight: bold; margin-bottom: 10px;">🚫 Детали блокировки</div>
                                            <div style="color: #ccc; font-size: 0.9rem; margin-bottom: 6px;">
                                                <strong>📝 Причина:</strong> ${ban.reason}
                                            </div>
                                            <div style="color: #ccc; font-size: 0.9rem; margin-bottom: 6px;">
                                                <strong>⏱️ Длительность:</strong> ${duration}
                                            </div>
                                            <div style="color: #ccc; font-size: 0.9rem; margin-bottom: 6px;">
                                                <strong>📅 Создана:</strong> ${createdDate}
                                            </div>
                                            ${ban.ends_at ? `
                                                <div style="color: #4CAF50; font-size: 0.9rem; font-weight: bold;">
                                                    <strong>🔓 Разблокировка:</strong> ${endDate}
                                                </div>
                                            ` : ''}
                                            <div style="color: #888; font-size: 0.8rem; margin-top: 8px;">
                                                <strong>👮 Модератор:</strong> ${moderatorInfo.username} (${moderatorInfo.email})
                                            </div>
                                        </div>
                                        
                                        <!-- Кнопки действий -->
                                        <div style="display: flex; flex-direction: column; gap: 8px;">
                                            <button 
                                                onclick="window.unbanUserFromComments('${ban.user_id}', '${userInfo.username}')" 
                                                style="background: linear-gradient(135deg, #4CAF50, #45a049); color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: bold; transition: all 0.3s ease;"
                                                onmouseover="this.style.background='linear-gradient(135deg, #45a049, #3d8b40)'" 
                                                onmouseout="this.style.background='linear-gradient(135deg, #4CAF50, #45a049)'"
                                            >
                                                🔓 Разблокировать
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `}
            </div>
        `;

    } catch (error) {
        console.error('❌ Ошибка загрузки детальных блокировок:', error);
        contentArea.innerHTML = `
            <div style="color: #ff4444; padding: 1rem; background: rgba(255, 68, 68, 0.1); border-radius: 5px;">
                ❌ Ошибка: ${error.message}
            </div>
        `;
    }
};

// Показывает модальное окно быстрой блокировки
window.showQuickBanModal = function() {
    // Проверяем есть ли уже открытые модальные окна блокировок
    const existingBanModal = document.querySelector('div[id*="ban-modal"]');
    if (existingBanModal) {
        console.log('🚫 Модальное окно блокировки уже открыто');
        return;
    }

    const modal = document.createElement('div');
    modal.id = 'quick-ban-modal';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.8); display: flex; justify-content: center; align-items: center;
        z-index: 99999;
    `;
    
    modal.innerHTML = `
        <div style="background: linear-gradient(135deg, #1a1a2e, #16213e); border: 2px solid #f44336; border-radius: 15px; padding: 30px; max-width: 600px; width: 90%; color: white; box-shadow: 0 20px 60px rgba(0,0,0,0.8);">
            <h3 style="color: #f44336; margin-bottom: 25px; text-align: center; font-size: 1.3rem;">🚫 Заблокировать комментарии</h3>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 6px; color: #ccc; font-weight: bold; font-size: 0.9rem;">Поиск пользователя:</label>
                <div style="display: flex; gap: 8px;">
                    <input type="text" id="ban-search-input" placeholder="Ник или email..." oninput="if(this.value.trim().length >= 2) setTimeout(() => window.searchUserForBan(), 300)" style="flex: 1; padding: 8px; background: rgba(0,0,0,0.3); border: 1px solid #f44336; color: white; border-radius: 6px; font-size: 0.85rem;">
                    <button onclick="window.searchUserForBan()" style="background: #ff9800; color: white; border: none; padding: 8px 15px; border-radius: 6px; cursor: pointer; font-weight: bold; white-space: nowrap; font-size: 0.85rem;">
                        🔍
                    </button>
                </div>
                <div id="search-results" style="margin-top: 8px; max-height: 120px; overflow-y: auto;"></div>
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; color: #ccc; font-weight: bold;">ID пользователя:</label>
                <input type="text" id="ban-user-id" placeholder="ID будет вставлен автоматически" style="width: 100%; padding: 12px; background: rgba(0,0,0,0.3); border: 1px solid #f44336; color: white; border-radius: 8px; font-size: 14px;" readonly>
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; color: #ccc; font-weight: bold;">Причина блокировки:</label>
                <input type="text" id="ban-reason" placeholder="Многократные нарушения правил" style="width: 100%; padding: 12px; background: rgba(0,0,0,0.3); border: 1px solid #f44336; color: white; border-radius: 8px; font-size: 14px;">
            </div>
            
            <div style="margin-bottom: 25px;">
                <label style="display: block; margin-bottom: 8px; color: #ccc; font-weight: bold;">Тип блокировки:</label>
                <select id="ban-type" onchange="window.toggleBanDuration()" style="width: 100%; padding: 12px; background: rgba(0,0,0,0.3); border: 1px solid #f44336; color: white; border-radius: 8px; font-size: 14px;">
                    <option value="comments">Только комментарии</option>
                    <option value="full">Полная блокировка доступа</option>
                </select>
            </div>
            
            <div id="duration-section" style="margin-bottom: 25px;">
                <label style="display: block; margin-bottom: 8px; color: #ccc; font-weight: bold;">Длительность:</label>
                <select id="ban-duration" style="width: 100%; padding: 12px; background: rgba(0,0,0,0.3); border: 1px solid #f44336; color: white; border-radius: 8px; font-size: 14px;">
                    <option value="1">1 день</option>
                    <option value="7">7 дней</option>
                    <option value="30" selected>30 дней</option>
                    <option value="90">90 дней</option>
                    <option value="permanent">Навсегда</option>
                </select>
            </div>
            
            <div style="display: flex; gap: 15px; justify-content: center;">
                <button onclick="window.executeQuickBan()" style="background: linear-gradient(135deg, #f44336, #d32f2f); color: white; border: none; padding: 12px 25px; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 15px; transition: all 0.3s ease;" onmouseover="this.style.background='linear-gradient(135deg, #d32f2f, #b71c1c)'" onmouseout="this.style.background='linear-gradient(135deg, #f44336, #d32f2f)'">
                    🚫 Заблокировать
                </button>
                <button onclick="this.closest('div[id*=ban-modal]').remove()" style="background: linear-gradient(135deg, #666, #555); color: white; border: none; padding: 12px 25px; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 15px; transition: all 0.3s ease;" onmouseover="this.style.background='linear-gradient(135deg, #555, #444)'" onmouseout="this.style.background='linear-gradient(135deg, #666, #555)'">
                    ❌ Отмена
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Фокус на поле поиска
    setTimeout(() => {
        document.getElementById('ban-search-input')?.focus();
    }, 100);
};

// Поиск пользователя для блокировки
window.searchUserForBan = async function() {
    const searchInput = document.getElementById('ban-search-input');
    const searchResults = document.getElementById('search-results');
    const userIdInput = document.getElementById('ban-user-id');
    
    const searchTerm = searchInput?.value?.trim();
    if (!searchTerm || searchTerm.length < 2) {
        searchResults.innerHTML = '<div style="color: #ff9800; font-size: 0.8rem;">Введите минимум 2 символа для поиска</div>';
        return;
    }

    searchResults.innerHTML = '<div style="color: #ccc; text-align: center; font-size: 0.8rem;">🔍 Поиск...</div>';

    try {
        // Улучшенный поиск - ищем по началу слова или точному совпадению, ИСКЛЮЧАЯ ВЛАДЕЛЬЦА
        const { data: users, error } = await window.supabase
            .from('profiles')
            .select('id, username, email, is_banned, role')
            .or(`username.ilike.${searchTerm}%,username.eq.${searchTerm},email.ilike.${searchTerm}%,email.eq.${searchTerm}`)
            .neq('role', 'owner') // ИСКЛЮЧАЕМ ВЛАДЕЛЬЦА
            .limit(8);

        if (error) throw error;

        if (!users || users.length === 0) {
            searchResults.innerHTML = '<div style="color: #f44336; font-size: 0.8rem;">Пользователи не найдены</div>';
            return;
        }

        let resultsHtml = '<div style="font-size: 0.8rem; color: #ccc; margin-bottom: 8px;">Найдено: ' + users.length + '</div>';
        
        users.forEach(user => {
            const status = user.is_banned ? '<span style="color: #f44336; font-size: 0.7rem;">🚫 Заблокирован</span>' : '<span style="color: #4CAF50; font-size: 0.7rem;">✅ Активен</span>';
            resultsHtml += `
                <div style="
                    background: rgba(0,0,0,0.3); 
                    border: 1px solid rgba(244, 67, 54, 0.3); 
                    border-radius: 6px; 
                    padding: 8px; 
                    margin-bottom: 6px; 
                    cursor: pointer;
                    transition: all 0.2s ease;
                    font-size: 0.8rem;
                " onclick="window.selectUserForBan('${user.id}', '${user.username}', '${user.email}')" 
                   onmouseover="this.style.background='rgba(244, 67, 54, 0.2)'" 
                   onmouseout="this.style.background='rgba(0,0,0,0.3)'">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="flex: 1; min-width: 0;">
                            <div style="color: #ff9800; font-weight: bold; font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${user.username}</div>
                            <div style="color: #ccc; font-size: 0.7rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${user.email}</div>
                        </div>
                        <div style="margin-left: 8px; flex-shrink: 0;">${status}</div>
                    </div>
                </div>
            `;
        });

        searchResults.innerHTML = resultsHtml;

    } catch (error) {
        console.error('❌ Ошибка поиска пользователя:', error);
        searchResults.innerHTML = '<div style="color: #f44336; font-size: 0.8rem;">Ошибка поиска</div>';
    }
};

// Выбирает пользователя для блокировки
window.selectUserForBan = function(userId, username, email) {
    const userIdInput = document.getElementById('ban-user-id');
    const searchResults = document.getElementById('search-results');
    
    if (userIdInput) {
        userIdInput.value = userId;
        userIdInput.style.background = 'rgba(76, 175, 80, 0.2)';
        userIdInput.style.borderColor = '#4CAF50';
        userIdInput.placeholder = `ID: ${userId}`;
        
        // Через 2 секунды возвращаем обычный стиль
        setTimeout(() => {
            userIdInput.style.background = 'rgba(0,0,0,0.3)';
            userIdInput.style.borderColor = '#f44336';
            userIdInput.placeholder = 'ID будет вставлен автоматически';
        }, 2000);
    }
    
    if (searchResults) {
        searchResults.innerHTML = `
            <div style="color: #4CAF50; font-size: 0.9rem; background: rgba(76, 175, 80, 0.1); padding: 8px; border-radius: 4px;">
                ✅ Выбран: ${username} (${email})<br>
                <small style="color: #ccc;">ID: ${userId} вставлен в поле</small>
            </div>
        `;
    }
    
    console.log('✅ Пользователь выбран для блокировки комментариев:', { userId, username, email });
};

// Переключает отображение длительности в зависимости от типа блокировки
window.toggleBanDuration = function() {
    const banType = document.getElementById('ban-type').value;
    const durationSection = document.getElementById('duration-section');
    
    if (banType === 'full') {
        durationSection.style.display = 'none';
    } else {
        durationSection.style.display = 'block';
    }
};

// Выполняет быструю блокировку
window.executeQuickBan = async function() {
    const userId = document.getElementById('ban-user-id')?.value?.trim();
    const reason = document.getElementById('ban-reason')?.value?.trim() || 'Нарушение правил';
    const duration = document.getElementById('ban-duration')?.value;
    const banType = document.getElementById('ban-type')?.value;

    if (!userId) {
        alert('❌ Выберите пользователя для блокировки');
        return;
    }

    try {
        if (banType === 'full') {
            // Полная блокировка доступа - блокируем пользователя в profiles
            const { error: profileError } = await window.supabase
                .from('profiles')
                .update({ 
                    is_banned: true,
                    ban_reason: reason,
                    banned_at: new Date().toISOString()
                })
                .eq('id', userId);

            if (profileError) {
                console.error('❌ Ошибка полной блокировки:', profileError);
                alert(`❌ Ошибка: ${profileError.message}`);
                return;
            }

            alert('✅ Пользователь полностью заблокирован! Доступ к сайту запрещен.');
            
        } else {
            // Блокировка только комментариев
            const { error: commentError } = await window.supabase
                .from('comment_bans')
                .insert({
                    user_id: userId,
                    moderator_id: window.authManager?.currentUser?.id,
                    reason: reason,
                    ban_type: duration === 'permanent' ? 'permanent' : 'temporary',
                    duration_days: duration === 'permanent' ? null : parseInt(duration),
                    starts_at: new Date().toISOString(),
                    ends_at: duration === 'permanent' ? null : new Date(Date.now() + parseInt(duration) * 24 * 60 * 60 * 1000).toISOString(),
                    is_active: true
                });

            if (commentError) {
                console.error('❌ Ошибка блокировки комментариев:', commentError);
                alert(`❌ Ошибка: ${commentError.message}`);
                return;
            }

            alert('✅ Комментарии пользователя заблокированы!');
        }

        // Закрываем модальное окно
        const modal = document.getElementById('quick-ban-modal');
        if (modal) {
            modal.remove();
        }
        
        // Обновляем данные
        await window.loadBansData();
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
        alert('❌ Произошла ошибка при блокировке');
    }
};

// Показывает модальное окно блокировки по email
window.showEmailBanModal = function() {
    // Проверяем есть ли уже открытые модальные окна блокировок
    const existingBanModal = document.querySelector('div[id*="ban-modal"]');
    if (existingBanModal) {
        console.log('🚫 Модальное окно блокировки уже открыто');
        return;
    }

    const modal = document.createElement('div');
    modal.id = 'email-ban-modal';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.8); display: flex; justify-content: center; align-items: center;
        z-index: 99999;
    `;
    
    modal.innerHTML = `
        <div style="background: linear-gradient(135deg, #1a1a2e, #16213e); border: 2px solid #ff9800; border-radius: 15px; padding: 30px; max-width: 600px; width: 90%; color: white; box-shadow: 0 20px 60px rgba(0,0,0,0.8);">
            <h3 style="color: #ff9800; margin-bottom: 25px; text-align: center; font-size: 1.3rem;">🚫 Полная блокировка доступа</h3>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 6px; color: #ccc; font-weight: bold; font-size: 0.9rem;">Поиск пользователя:</label>
                <div style="display: flex; gap: 8px;">
                    <input type="text" id="email-ban-search-input" placeholder="Ник или email..." oninput="if(this.value.trim().length >= 2) setTimeout(() => window.searchUserForEmailBan(), 300)" style="flex: 1; padding: 8px; background: rgba(0,0,0,0.3); border: 1px solid #ff9800; color: white; border-radius: 6px; font-size: 0.85rem;">
                    <button onclick="window.searchUserForEmailBan()" style="background: #ff9800; color: white; border: none; padding: 8px 15px; border-radius: 6px; cursor: pointer; font-weight: bold; white-space: nowrap; font-size: 0.85rem;">
                        🔍
                    </button>
                </div>
                <div id="email-ban-search-results" style="margin-top: 8px; max-height: 120px; overflow-y: auto;"></div>
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; color: #ccc; font-weight: bold;">ID пользователя:</label>
                <input type="text" id="email-ban-user-id" placeholder="ID будет вставлен автоматически" style="width: 100%; padding: 12px; background: rgba(0,0,0,0.3); border: 1px solid #ff9800; color: white; border-radius: 8px; font-size: 14px;" readonly>
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; color: #ccc; font-weight: bold;">Причина блокировки:</label>
                <input type="text" id="email-ban-reason" placeholder="Грубые нарушения правил" style="width: 100%; padding: 12px; background: rgba(0,0,0,0.3); border: 1px solid #ff9800; color: white; border-radius: 8px; font-size: 14px;">
            </div>
            
            <div style="margin-bottom: 25px; padding: 15px; background: rgba(255, 152, 0, 0.1); border: 1px solid rgba(255, 152, 0, 0.3); border-radius: 8px;">
                <div style="color: #ff9800; font-weight: bold; margin-bottom: 10px;">⚠️ Внимание!</div>
                <div style="color: #ccc; font-size: 0.9rem; line-height: 1.4;">
                    Полная блокировка запрещает пользователю:<br>
                    • Вход на сайт<br>
                    • Регистрацию новых аккаунтов<br>
                    • Доступ ко всем функциям сайта<br>
                    • Пользователь будет немедленно выведен из системы
                </div>
            </div>
            
            <div style="display: flex; gap: 15px; justify-content: center;">
                <button onclick="window.executeEmailBan()" style="background: linear-gradient(135deg, #ff9800, #f57c00); color: white; border: none; padding: 12px 25px; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 15px; transition: all 0.3s ease;" onmouseover="this.style.background='linear-gradient(135deg, #f57c00, #ef6c00)'" onmouseout="this.style.background='linear-gradient(135deg, #ff9800, #f57c00)'">
                    🚫 Заблокировать доступ
                </button>
                <button onclick="this.closest('div[id*=ban-modal]').remove()" style="background: linear-gradient(135deg, #666, #555); color: white; border: none; padding: 12px 25px; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 15px; transition: all 0.3s ease;" onmouseover="this.style.background='linear-gradient(135deg, #555, #444)'" onmouseout="this.style.background='linear-gradient(135deg, #666, #555)'">
                    ❌ Отмена
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Фокус на поле поиска
    setTimeout(() => {
        document.getElementById('email-ban-search-input')?.focus();
    }, 100);
};

// Поиск пользователя для блокировки по email
window.searchUserForEmailBan = async function() {
    const searchInput = document.getElementById('email-ban-search-input');
    const searchResults = document.getElementById('email-ban-search-results');
    const userIdInput = document.getElementById('email-ban-user-id');
    
    const searchTerm = searchInput?.value?.trim();
    if (!searchTerm || searchTerm.length < 2) {
        searchResults.innerHTML = '<div style="color: #ff9800; font-size: 0.8rem;">Введите минимум 2 символа для поиска</div>';
        return;
    }

    searchResults.innerHTML = '<div style="color: #ccc; text-align: center; font-size: 0.8rem;">🔍 Поиск...</div>';

    try {
        // Улучшенный поиск - ищем по началу слова или точному совпадению, ИСКЛЮЧАЯ ВЛАДЕЛЬЦА
        const { data: users, error } = await window.supabase
            .from('profiles')
            .select('id, username, email, is_banned, role')
            .or(`username.ilike.${searchTerm}%,username.eq.${searchTerm},email.ilike.${searchTerm}%,email.eq.${searchTerm}`)
            .neq('role', 'owner') // ИСКЛЮЧАЕМ ВЛАДЕЛЬЦА
            .limit(8);

        if (error) throw error;

        if (!users || users.length === 0) {
            searchResults.innerHTML = '<div style="color: #f44336; font-size: 0.8rem;">Пользователи не найдены</div>';
            return;
        }

        let resultsHtml = '<div style="font-size: 0.8rem; color: #ccc; margin-bottom: 8px;">Найдено: ' + users.length + '</div>';
        
        users.forEach(user => {
            const status = user.is_banned ? '<span style="color: #f44336; font-size: 0.7rem;">🚫 Уже заблокирован</span>' : '<span style="color: #4CAF50; font-size: 0.7rem;">✅ Активен</span>';
            resultsHtml += `
                <div style="
                    background: rgba(0,0,0,0.3); 
                    border: 1px solid rgba(255, 152, 0, 0.3); 
                    border-radius: 6px; 
                    padding: 8px; 
                    margin-bottom: 6px; 
                    cursor: pointer;
                    transition: all 0.2s ease;
                    font-size: 0.8rem;
                    ${user.is_banned ? 'opacity: 0.5; cursor: not-allowed;' : ''}
                " ${!user.is_banned ? `onclick="window.selectUserForEmailBan('${user.id}', '${user.username}', '${user.email}')"` : ''}
                   onmouseover="this.style.background='rgba(255, 152, 0, 0.2)'" 
                   onmouseout="this.style.background='rgba(0,0,0,0.3)'">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="flex: 1; min-width: 0;">
                            <div style="color: #ff9800; font-weight: bold; font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${user.username}</div>
                            <div style="color: #ccc; font-size: 0.7rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${user.email}</div>
                        </div>
                        <div style="margin-left: 8px; flex-shrink: 0;">${status}</div>
                    </div>
                </div>
            `;
        });

        searchResults.innerHTML = resultsHtml;

    } catch (error) {
        console.error('❌ Ошибка поиска пользователя:', error);
        searchResults.innerHTML = '<div style="color: #f44336; font-size: 0.8rem;">Ошибка поиска</div>';
    }
};

// Выбирает пользователя для блокировки по email
window.selectUserForEmailBan = function(userId, username, email) {
    const userIdInput = document.getElementById('email-ban-user-id');
    const searchResults = document.getElementById('email-ban-search-results');
    
    if (userIdInput) {
        userIdInput.value = userId;
        userIdInput.style.background = 'rgba(76, 175, 80, 0.2)';
        userIdInput.style.borderColor = '#4CAF50';
        userIdInput.placeholder = `ID: ${userId}`;
        
        // Через 2 секунды возвращаем обычный стиль
        setTimeout(() => {
            userIdInput.style.background = 'rgba(0,0,0,0.3)';
            userIdInput.style.borderColor = '#ff9800';
            userIdInput.placeholder = 'ID будет вставлен автоматически';
        }, 2000);
    }
    
    if (searchResults) {
        searchResults.innerHTML = `
            <div style="color: #4CAF50; font-size: 0.9rem; background: rgba(76, 175, 80, 0.1); padding: 8px; border-radius: 4px;">
                ✅ Выбран: ${username} (${email})<br>
                <small style="color: #ccc;">ID: ${userId} вставлен в поле</small>
            </div>
        `;
    }
    
    console.log('✅ Пользователь выбран:', { userId, username, email });
};

// Выполняет полную блокировку по email
window.executeEmailBan = async function() {
    const userId = document.getElementById('email-ban-user-id')?.value?.trim();
    const reason = document.getElementById('email-ban-reason')?.value?.trim() || 'Грубые нарушения правил';

    if (!userId) {
        alert('❌ Выберите пользователя для блокировки');
        return;
    }

    if (!confirm(`⚠️ ВНИМАНИЕ! Вы уверены, что хотите полностью заблокировать пользователя?\n\nПричина: ${reason}\n\nПользователь будет немедленно выведен из системы и не сможет зайти на сайт!`)) {
        return;
    }

    try {
        // Используем новую функцию с принудительным выходом
        const success = await window.executeFullBanWithLogout(userId, reason);
        
        if (!success) {
            throw new Error('Не удалось заблокировать пользователя');
        }

        alert('✅ Пользователь полностью заблокирован! Доступ к сайту прекращен.');
        
        // Закрываем модальное окно
        const modal = document.getElementById('email-ban-modal');
        if (modal) {
            modal.remove();
        }
        
        // Обновляем данные
        await window.loadBansData();
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
        alert('❌ Произошла ошибка при блокировке');
    }
};

window.showModsManagement = async function() {
    const contentArea = document.getElementById('admin-content-area');
    if (!contentArea) {
        console.error('❌ Контейнер admin-content-area не найден');
        return;
    }

    try {
        // Загружаем категории для формы
        const { data: categories, error: categoriesError } = await window.supabase
            .from('mod_categories')
            .select('*')
            .order('name');

        if (categoriesError) throw categoriesError;

        const categoryOptions = categories
            .filter(cat => cat.id !== 'all')
            .map(cat => `<option value="${cat.id}">${cat.name || cat.id}</option>`)
            .join('');

        // Создаем интерфейс на весь экран
        contentArea.innerHTML = `
            <div style="color: #00ff41; class=\ scrollable\">
                <h4 style="margin-bottom: 15px;">🛠️ Управление модами</h4>
                
                <!-- Простая форма загрузки -->
                <div style="background: rgba(0,255,65,0.08); border: 2px solid rgba(0,255,65,0.3); border-radius: 15px; padding: 15px; margin-bottom: 15px;">
                    <h5 style="color: #00ff41; margin-top: 0; margin-bottom: 10px;">🚀 Загрузить новый мод</h5>
                    <form id="uploadModForm" onsubmit="console.log('🚀 [admin-panel-fixed] Форма отправлена!'); window.uploadMod(event); return false;" style="display: flex; flex-direction: column; gap: 10px;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            <div>
                                <label style="color: #00ff41; font-weight: bold; display: block; margin-bottom: 3px;">Название:</label>
                                <input type="text" id="modName" placeholder="Название мода" required
                                       style="width: 100%; padding: 8px; background: rgba(0,255,65,0.1); border: 1px solid rgba(0,255,65,0.3); border-radius: 5px; color: #00ff41; font-size: 13px;">
                            </div>
                            <div>
                                <label style="color: #00ff41; font-weight: bold; display: block; margin-bottom: 3px;">Категория:</label>
                                <select id="modCategory" required
                                        style="width: 100%; padding: 8px; background: rgba(0,255,65,0.1); border: 1px solid rgba(0,255,65,0.3); border-radius: 5px; color: #00ff41; font-size: 13px;">
                                    ${categoryOptions}
                                </select>
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            <div>
                                <label style="color: #00ff41; font-weight: bold; display: block; margin-bottom: 3px;">Версия игры:</label>
                                <select id="modGameVersion" required
                                        style="width: 100%; padding: 8px; background: rgba(0,255,65,0.1); border: 1px solid rgba(0,255,65,0.3); border-radius: 5px; color: #00ff41; font-size: 13px;">
                                    <option value="fs25">FS25</option>
                                    <option value="fs22">FS22</option>
                                    <option value="fs19">FS19</option>
                                </select>
                            </div>
                            <div>
                                <label style="color: #00ff41; font-weight: bold; display: block; margin-bottom: 3px;">Версия мода:</label>
                                <input type="text" id="modVersion" placeholder="1.0.0.0" required
                                       pattern="[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+"
                                       title="Формат версии: 1.0.0.0"
                                       style="width: 100%; padding: 8px; background: rgba(0,255,65,0.1); border: 1px solid rgba(0,255,65,0.3); border-radius: 5px; color: #00ff41; font-size: 13px;">
                            </div>
                        </div>

                        <!-- Описание на всю ширину с отступами -->
                        <div style="margin: 0 -5px;">
                            <label style="color: #00ff41; font-weight: bold; display: block; margin-bottom: 3px; margin-left: 5px;">Описание:</label>
                            <textarea id="modDescription" placeholder="Краткое описание мода" rows="2" required
                                      style="width: calc(100% - 10px); padding: 8px; background: rgba(0,255,65,0.1); border: 1px solid rgba(0,255,65,0.3); border-radius: 5px; color: #00ff41; font-size: 13px; resize: vertical; min-height: 60px; margin: 0 5px;"></textarea>
                        </div>

                        <!-- Автор модификации -->
                        <div style="margin: 0 -5px;">
                            <label style="color: #00ff41; font-weight: bold; display: block; margin-bottom: 3px; margin-left: 5px;">Автор модификации:</label>
                            <input type="text" id="modAuthor" placeholder="Имя создателя мода" required
                                   style="width: calc(100% - 10px); padding: 8px; background: rgba(0,255,65,0.1); border: 1px solid rgba(0,255,65,0.3); border-radius: 5px; color: #00ff41; font-size: 13px; margin: 0 5px;">
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            <div>
                                <label style="color: #00ff41; font-weight: bold; display: block; margin-bottom: 3px;">YouTube:</label>
                                <input type="url" id="youtubeLink" placeholder="https://youtube.com/..."
                                       style="width: 100%; padding: 6px; background: rgba(0,255,65,0.1); border: 1px solid rgba(255,152,0,0.5); border-radius: 5px; color: #ff9800; font-size: 12px;">
                            </div>
                            <div>
                                <label style="color: #00ff41; font-weight: bold; display: block; margin-bottom: 3px;">VK Видео:</label>
                                <input type="url" id="vkVideoLink" placeholder="https://vk.com/video..."
                                       style="width: 100%; padding: 6px; background: rgba(0,255,65,0.1); border: 1px solid rgba(87, 119, 161, 0.5); border-radius: 5px; color: #5777a1; font-size: 12px;">
                            </div>
                        </div>
                        <div style="background: rgba(255,215,0,0.1); padding: 4px 6px; border-radius: 5px; border: 1px solid #ffd700; display: flex; align-items: center;">
                            <label style="color: #ffd700; font-weight: bold; display: flex; align-items: center; gap: 6px; cursor: pointer; margin: 0; font-size: 12px;">
                                <input type="checkbox" id="isPrivateMod" style="width: 14px; height: 14px;">
                                💎 VIP мод
                            </label>
                        </div>

                        <!-- Блок загрузки изображений -->
                        <div>
                            <label style="color: #00ff41; font-weight: bold; display: block; margin-bottom: 5px;">Изображения мода (до 4 шт.):</label>
                            <div style="color: #888; font-size: 0.8rem; margin-bottom: 10px; line-height: 1.3;">
                                📏 <b>Рекомендуемый размер:</b> 800x600 - 1920x1080 пикселей<br>
                                💾 <b>Максимальный вес:</b> до 5 МБ на файл<br>
                                🎯 <b>Форматы:</b> JPG, PNG, WebP (PNG - для качества, JPG - для сжатия)
                            </div>
                            <div id="mod-image-upload-container" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px;">
                                ${[...Array(4)].map((_, i) => `
                                    <div class="image-upload-slot" style="aspect-ratio: 16/9; border: 2px dashed #00ff41; border-radius: 8px; display: flex; align-items: center; justify-content: center; position: relative; background: rgba(0,255,65,0.05); transition: all 0.3s ease;">
                                        <img id="image-preview-${i}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 6px; display: none;">
                                        <label for="modImage${i}" style="cursor: pointer; text-align: center; color: #00ff41; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                                            <span style="font-size: 1.5rem; margin-bottom: 5px;">📷</span>
                                            <span id="image-label-${i}" style="font-size: 0.7rem;">Изобр. ${i + 1}</span>
                                        </label>
                                        <input type="file" id="modImage${i}" accept="image/*" class="mod-image-input" data-index="${i}" style="display: none;" onchange="previewModImage(event)">
                                        <button type="button" id="remove-image-${i}" onclick="removeModImage(${i})"
                                                style="position: absolute; top: 2px; right: 2px; background: #f44336; color: white; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; display: none; font-weight: bold; font-size: 12px; line-height: 20px; text-align: center;">✕</button>
                                    </div>
                                `).join('')}
                            </div>
                        </div>

                        <!-- Ссылка на файл -->
                        <div>
                            <label style="color: #00ff41; font-weight: bold; display: block; margin-bottom: 3px;">Ссылка на файл:</label>
                            <input type="url" id="modDownloadUrl" placeholder="https://..." required
                                   style="width: 100%; padding: 8px; background: rgba(0,255,65,0.1); border: 1px solid rgba(0,204,255,0.5); border-radius: 5px; color: #00ccff; font-size: 13px;">
                        </div>

                        <div id="admin-uploadProgress" style="display: none; background: rgba(0,255,65,0.1); padding: 10px; border-radius: 5px; border: 1px solid #00ff41;">
                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
                                <span style="color: #00ff41; font-weight: bold; font-size: 12px;">Загрузка...</span>
                                <div style="flex: 1; background: rgba(0,255,65,0.2); height: 6px; border-radius: 3px; overflow: hidden;">
                                    <div id="admin-progressBar" style="background: #00ff41; height: 100%; width: 0%; transition: width 0.3s ease;"></div>
                                </div>
                            </div>
                            <p id="admin-uploadStatus" style="color: #ff9800; margin: 0; font-size: 11px;"></p>
                        </div>

                        <button type="submit" style="background: linear-gradient(135deg, #4CAF50, #45a049); color: white; border: none; padding: 10px; border-radius: 5px; font-size: 14px; font-weight: bold; cursor: pointer; transition: all 0.3s ease;">
                            🚀 ЗАГРУЗИТЬ МОД
                        </button>
                    </form>
                </div>

                <!-- Список загруженных модов -->
                <div style="background: rgba(0,255,65,0.05); border: 1px solid rgba(0,255,65,0.2); border-radius: 10px; padding: 15px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <h5 style="color: #00ff41; margin: 0; font-size: 14px;">📋 Загруженные моды</h5>
                        <button onclick="refreshAdminMods()" style="background: #00ccff; color: #000; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; font-size: 12px; font-weight: bold;">🔄 Обновить</button>
                    </div>
                    <div id="mods-for-moderation-list" style="max-height: 500px; overflow-y: auto; overflow-x: hidden;">
                        <div style="text-align: center; color: #00ff41; font-size: 12px; margin: 10px 0;">⏳ Загрузка модов...</div>
                    </div>
                </div>
            </div>
        `;

        // Простая функция обновления модов
        window.refreshAdminMods = async function() {
            console.log('🔄 Обновляем список модов...');
            console.log('🔍 Проверяем window.supabase:', typeof window.supabase);
            console.log('🔍 Проверяем window.supabase.from:', typeof window.supabase?.from);
            
            const container = document.getElementById('mods-for-moderation-list');
            if (!container) {
                console.log('ℹ️ Контейнер модов не найден - админ-панель не открыта или не в разделе модов');
                return; // Это нормально, если админ-панель не открыта
            }
            
            container.innerHTML = '<div style="text-align: center; color: #00ff41; font-size: 12px; margin: 10px 0;">⏳ Обновление модов...</div>';
            
            // Проверяем доступность Supabase
            if (!window.supabase || typeof window.supabase.from !== 'function') {
                console.error('❌ Supabase клиент не инициализирован или функция from недоступна');
                container.innerHTML = '<p style="color: #f44336; text-align: center;">❌ Ошибка: Supabase клиент не инициализирован. Проверьте подключение к базе данных.</p>';
                return;
            }
            
            try {
                // Загружаем ТОЛЬКО обычные моды (is_private = false)
                const { data: mods, error } = await window.supabase
                    .from('mods')
                    .select('*')
                    .eq('is_private', false)
                    .order('created_at', { ascending: false });

                if (error) throw error;

                // Считаем моды по версиям игр
                const fs25Count = mods.filter(m => m.game_version === 'fs25').length;
                const fs22Count = mods.filter(m => m.game_version === 'fs22').length;
                const fs19Count = mods.filter(m => m.game_version === 'fs19').length;
                const totalCount = mods.length;

                // Обновляем заголовок со статистикой (по цветам игр)
                const headerElement = document.querySelector('#mods-for-moderation-list').previousElementSibling.querySelector('h5');
                if (headerElement) {
                    headerElement.innerHTML = `📋 Загруженные моды <span style="background: rgba(0,255,65,0.2); padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">Всего: ${totalCount}</span> <span style="background: rgba(76,175,80,0.3); color: #4CAF50; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem; margin-left: 5px; font-weight: bold;">🟢 FS25: ${fs25Count}</span> <span style="background: rgba(33,150,243,0.3); color: #2196F3; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem; margin-left: 5px; font-weight: bold;">🔵 FS22: ${fs22Count}</span> <span style="background: rgba(255,193,7,0.3); color: #FFC107; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem; margin-left: 5px; font-weight: bold;">🟡 FS19: ${fs19Count}</span>`;
                }

                if (mods.length === 0) {
                    container.innerHTML = '<p style="text-align: center; color: #8892b0;">✅ Моды не найдены.</p>';
                    return;
                }

                // Собираем уникальные ID пользователей (user_id - кто залил мод)
                const userIds = [...new Set(mods.map(mod => mod.user_id).filter(id => id))];
                let profiles = {};

                if (userIds.length > 0) {
                    try {
                        const { data: profilesData, error: profilesError } = await window.supabase
                            .from('profiles')
                            .select('id, username')
                            .in('id', userIds);

                        if (!profilesError && profilesData) {
                            profiles = profilesData.reduce((acc, profile) => {
                                acc[profile.id] = profile;
                                return acc;
                            }, {});
                        }
                    } catch (profileError) {
                        console.warn('⚠️ Не удалось загрузить профили:', profileError);
                    }
                }

                let modsHtml = mods.map(mod => {
                    const isApproved = mod.is_approved;
                    const isPrivate = mod.is_private;
                    const uploaderProfile = profiles[mod.user_id]; // Профиль пользователя, который залил мод
                    const uploaderUsername = uploaderProfile?.username || 'Неизвестен';

                    const statusBadge = isApproved
                        ? `<span style="background: #4CAF50; color: white; padding: 3px 8px; border-radius: 12px; font-size: 0.7rem;">Одобрен</span>`
                        : `<span style="background: #ff9800; color: white; padding: 3px 8px; border-radius: 12px; font-size: 0.7rem;">На модерации</span>`;

                    const privateBadge = isPrivate
                        ? `<span style="background: #ffd700; color: #000; padding: 3px 8px; border-radius: 12px; font-size: 0.7rem; margin-left: 5px;">💎 VIP</span>`
                        : ''; 

                    // Упрощенная логика для изображений с отладкой
                    console.log('🖼️ [admin-panel-fixed] Изображения мода:', mod.name, mod.images);
                    let mainImageUrl = '';
                    if (mod.images && Array.isArray(mod.images) && mod.images.length > 0) {
                        const firstImage = mod.images[0];
                        if (firstImage && typeof firstImage === 'string' && firstImage.trim() !== '') {
                            // Base64 или URL
                            if (firstImage.startsWith('data:image')) {
                                mainImageUrl = firstImage; // Base64 как есть
                            } else {
                                mainImageUrl = firstImage;
                            }
                            console.log('🖼️ [admin-panel-fixed] Используем строковое изображение:', mainImageUrl.substring(0, 50) + '...');
                        } else if (firstImage && typeof firstImage === 'object' && firstImage.url) {
                            mainImageUrl = firstImage.url;
                            console.log('🖼️ [admin-panel-fixed] Используем объектное изображение:', mainImageUrl);
                        } else {
                            console.log('🖼️ [admin-panel-fixed] Неизвестный формат изображения:', firstImage);
                        }
                    } else {
                        console.log('🖼️ [admin-panel-fixed] У мода нет изображений или пустой массив');
                    }

                    return `
                        <div class="moderation-mod-card" style="display: flex; flex-direction: column; gap: 15px; background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid ${isApproved ? '#4CAF50' : '#ff9800'};">
                            <div style="display: flex; align-items: center; gap: 15px;">
                                ${mainImageUrl ? `<img src="${mainImageUrl}" alt="${mod.name}" style="width: 120px; height: 72px; object-fit: cover; border-radius: 4px;">` : '<div style="width: 120px; height: 72px; background: rgba(0,255,65,0.1); border: 1px solid rgba(0,255,65,0.3); border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #00ff41; font-size: 12px;">📷 Нет изображения</div>'}
                                <div style="flex: 1; min-width: 0;">
                                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                                        <h5 style="margin: 0; color: #00ff41; font-size: 1.1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${mod.name}">${mod.name}</h5>
                                        <div style="display: flex; gap: 5px; flex-shrink: 0;">
                                            ${statusBadge}
                                            ${privateBadge}
                                        </div>
                                    </div>
                                    <p style="margin: 8px 0; font-size: 0.9rem; color: #8892b0;">
                                        Автор модификации: <span style="color: #4fc3f7;">${mod.mod_author || 'Неизвестен'}</span> |
                                        Игра: ${(() => {
                                            const gv = mod.game_version?.toLowerCase();
                                            if (gv === 'fs25') return '<span style="background: rgba(76,175,80,0.2); color: #4CAF50; padding: 2px 6px; border-radius: 4px; font-size: 0.8rem; font-weight: bold;">🟢 FS25</span>';
                                            if (gv === 'fs22') return '<span style="background: rgba(33,150,243,0.2); color: #2196F3; padding: 2px 6px; border-radius: 4px; font-size: 0.8rem; font-weight: bold;">🔵 FS22</span>';
                                            if (gv === 'fs19') return '<span style="background: rgba(255,193,7,0.2); color: #FFC107; padding: 2px 6px; border-radius: 4px; font-size: 0.8rem; font-weight: bold;">🟡 FS19</span>';
                                            return `<span style="color: #4fc3f7;">${mod.game_version?.toUpperCase() || 'FS25'}</span>`;
                                        })()} |
                                        Категория: <span style="color: #4fc3f7;">${getRussianCategoryName(mod.category)}</span>
                                    </p>
                                    <p style="margin: 4px 0; font-size: 0.8rem; color: #64748b;">
                                        📅 Залил мод: <span style="color: #4fc3f7;">${uploaderUsername}</span> | 
                                        Загружено: ${new Date(mod.created_at).toLocaleString('ru-RU', { 
                                            day: '2-digit', 
                                            month: '2-digit', 
                                            year: '2-digit', 
                                            hour: '2-digit', 
                                            minute: '2-digit' 
                                        })}
                                    </p>
                                </div>
                                <div class="moderation-actions" style="display: flex; gap: 8px; flex-shrink: 0;">
                                    ${!isApproved ? `<button onclick="window.approveMod('${mod.id}')" class="hacker-btn-small" style="background: #4CAF50;" title="Одобрить мод">✔️</button>` : ''}
                                    <button onclick="window.editRegularMod('${mod.id}')" class="hacker-btn-small" style="background: #ff9800;" title="Редактировать мод">✏️</button>
                                    <button onclick="window.deleteMod('${mod.id}', '${mod.name.replace(/'/g, "\\'")}')" class="hacker-btn-small" style="background: #f44336;" title="Удалить мод">🗑️</button>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');

                container.innerHTML = modsHtml;

                // ✅ ОСТАВЛЯЕМ заголовок со счётчиками, который был установлен выше (строка 1729)
                // Не перезаписываем его, чтобы сохранить отображение FS25/FS22/FS19

                console.log('✅ Моды успешно обновлены');

            } catch (error) {
                console.error("❌ Ошибка обновления модов:", error);
                container.innerHTML = `<p style="color: #f44336; text-align: center;">Ошибка загрузки модов: ${error.message}</p>`;
            }
        };

        // Загружаем список модов со счётчиками
        refreshAdminMods();

    } catch (error) {
        console.error('❌ Ошибка загрузки управления модами:', error);
        contentArea.innerHTML = `
            <div style="color: #f44336; padding: 20px; text-align: center;">
                <h4>❌ Ошибка загрузки управления модами</h4>
                <p>${error.message}</p>
            </div>
        `;
    }
};

// Функция для управления VIP модами
window.showVipModsManagement = async function() {
    const contentArea = document.getElementById('admin-content-area');
    if (!contentArea) {
        console.error('❌ Контейнер admin-content-area не найден');
        return;
    }

    try {
        // Загружаем категории для формы
        const { data: categories, error: categoriesError } = await window.supabase
            .from('mod_categories')
            .select('*')
            .order('name');

        if (categoriesError) throw categoriesError;

        const categoryOptions = categories
            .filter(cat => cat.id !== 'all')
            .map(cat => `<option value="${cat.id}">${cat.name || cat.id}</option>`)
            .join('');

        // Создаем интерфейс на весь экран
        contentArea.innerHTML = `
            <div style="color: #FFD700;" class="scrollable">
                <h4 style="margin-bottom: 15px; color: #FFD700; text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);">👑 Управление VIP модами</h4>

                <!-- Простая форма загрузки -->
                <div style="background: linear-gradient(135deg, rgba(184, 134, 11, 0.15), rgba(218, 165, 32, 0.08)); border: 2px solid rgba(218, 165, 32, 0.5); border-radius: 15px; padding: 20px; margin-bottom: 15px; box-shadow: 0 0 20px rgba(218, 165, 32, 0.3);">
                    <h5 style="color: #FFD700; margin-top: 0; margin-bottom: 15px; text-shadow: 0 0 8px rgba(255, 215, 0, 0.4);">🚀 Загрузить новый VIP мод</h5>
                    <form id="uploadModForm" onsubmit="console.log('🚀 [admin-panel-fixed] Форма отправлена!'); window.uploadMod(event); return false;" style="display: flex; flex-direction: column; gap: 12px;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                            <div>
                                <label style="color: #FFD700; font-weight: bold; display: block; margin-bottom: 5px; text-shadow: 0 0 5px rgba(255, 215, 0, 0.3);">Название:</label>
                                <input type="text" id="modName" placeholder="Название мода" required
                                       style="width: 100%; padding: 10px; background: rgba(184, 134, 11, 0.15); border: 2px solid rgba(218, 165, 32, 0.4); border-radius: 8px; color: #FFD700; font-size: 14px; box-shadow: inset 0 0 10px rgba(184, 134, 11, 0.2); transition: all 0.3s ease;" onfocus="this.style.borderColor='rgba(255, 215, 0, 0.8)'; this.style.boxShadow='0 0 15px rgba(255, 215, 0, 0.4)'" onblur="this.style.borderColor='rgba(218, 165, 32, 0.4)'; this.style.boxShadow='inset 0 0 10px rgba(184, 134, 11, 0.2)'">
                            </div>
                            <div>
                                <label style="color: #FFD700; font-weight: bold; display: block; margin-bottom: 5px; text-shadow: 0 0 5px rgba(255, 215, 0, 0.3);">Категория:</label>
                                <select id="modCategory" required
                                        style="width: 100%; padding: 10px; background: rgba(184, 134, 11, 0.15); border: 2px solid rgba(218, 165, 32, 0.4); border-radius: 8px; color: #FFD700; font-size: 14px; box-shadow: inset 0 0 10px rgba(184, 134, 11, 0.2); transition: all 0.3s ease;" onfocus="this.style.borderColor='rgba(255, 215, 0, 0.8)'; this.style.boxShadow='0 0 15px rgba(255, 215, 0, 0.4)'" onblur="this.style.borderColor='rgba(218, 165, 32, 0.4)'; this.style.boxShadow='inset 0 0 10px rgba(184, 134, 11, 0.2)'">
                                    ${categoryOptions}
                                </select>
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                            <div>
                                <label style="color: #FFD700; font-weight: bold; display: block; margin-bottom: 5px; text-shadow: 0 0 5px rgba(255, 215, 0, 0.3);">Версия игры:</label>
                                <select id="modGameVersion" required
                                        style="width: 100%; padding: 10px; background: rgba(184, 134, 11, 0.15); border: 2px solid rgba(218, 165, 32, 0.4); border-radius: 8px; color: #FFD700; font-size: 14px; box-shadow: inset 0 0 10px rgba(184, 134, 11, 0.2); transition: all 0.3s ease;" onfocus="this.style.borderColor='rgba(255, 215, 0, 0.8)'; this.style.boxShadow='0 0 15px rgba(255, 215, 0, 0.4)'" onblur="this.style.borderColor='rgba(218, 165, 32, 0.4)'; this.style.boxShadow='inset 0 0 10px rgba(184, 134, 11, 0.2)'">
                                    <option value="fs25" style="background: #1a1a2e; color: #FFD700;">FS25</option>
                                    <option value="fs22" style="background: #1a1a2e; color: #FFD700;">FS22</option>
                                    <option value="fs19" style="background: #1a1a2e; color: #FFD700;">FS19</option>
                                </select>
                            </div>
                            <div>
                                <label style="color: #FFD700; font-weight: bold; display: block; margin-bottom: 5px; text-shadow: 0 0 5px rgba(255, 215, 0, 0.3);">Версия мода:</label>
                                <input type="text" id="modVersion" placeholder="1.0.0.0" required
                                       pattern="[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+"
                                       title="Формат версии: 1.0.0.0"
                                       style="width: 100%; padding: 10px; background: rgba(184, 134, 11, 0.15); border: 2px solid rgba(218, 165, 32, 0.4); border-radius: 8px; color: #FFD700; font-size: 14px; box-shadow: inset 0 0 10px rgba(184, 134, 11, 0.2); transition: all 0.3s ease;" onfocus="this.style.borderColor='rgba(255, 215, 0, 0.8)'; this.style.boxShadow='0 0 15px rgba(255, 215, 0, 0.4)'" onblur="this.style.borderColor='rgba(218, 165, 32, 0.4)'; this.style.boxShadow='inset 0 0 10px rgba(184, 134, 11, 0.2)'">
                            </div>
                        </div>

                        <!-- Описание на всю ширину с отступами -->
                        <div style="margin: 0 -5px;">
                            <label style="color: #FFD700; font-weight: bold; display: block; margin-bottom: 5px; margin-left: 5px; text-shadow: 0 0 5px rgba(255, 215, 0, 0.3);">Описание:</label>
                            <textarea id="modDescription" placeholder="Краткое описание мода" rows="2" required
                                      style="width: calc(100% - 10px); padding: 10px; background: rgba(184, 134, 11, 0.15); border: 2px solid rgba(218, 165, 32, 0.4); border-radius: 8px; color: #FFD700; font-size: 14px; resize: vertical; min-height: 70px; margin: 0 5px; box-shadow: inset 0 0 10px rgba(184, 134, 11, 0.2); transition: all 0.3s ease;" onfocus="this.style.borderColor='rgba(255, 215, 0, 0.8)'; this.style.boxShadow='0 0 15px rgba(255, 215, 0, 0.4)'" onblur="this.style.borderColor='rgba(218, 165, 32, 0.4)'; this.style.boxShadow='inset 0 0 10px rgba(184, 134, 11, 0.2)'"></textarea>
                        </div>

                        <!-- Автор модификации -->
                        <div style="margin: 0 -5px;">
                            <label style="color: #FFD700; font-weight: bold; display: block; margin-bottom: 5px; margin-left: 5px; text-shadow: 0 0 5px rgba(255, 215, 0, 0.3);">Автор модификации:</label>
                            <input type="text" id="modAuthor" placeholder="Имя создателя мода" required
                                   style="width: calc(100% - 10px); padding: 10px; background: rgba(184, 134, 11, 0.15); border: 2px solid rgba(218, 165, 32, 0.4); border-radius: 8px; color: #FFD700; font-size: 14px; box-shadow: inset 0 0 10px rgba(184, 134, 11, 0.2); transition: all 0.3s ease; margin: 0 5px;" onfocus="this.style.borderColor='rgba(255, 215, 0, 0.8)'; this.style.boxShadow='0 0 15px rgba(255, 215, 0, 0.4)'" onblur="this.style.borderColor='rgba(218, 165, 32, 0.4)'; this.style.boxShadow='inset 0 0 10px rgba(184, 134, 11, 0.2)'">
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                            <div>
                                <label style="color: #FFD700; font-weight: bold; display: block; margin-bottom: 5px; text-shadow: 0 0 5px rgba(255, 215, 0, 0.3);">YouTube:</label>
                                <input type="url" id="youtubeLink" placeholder="https://youtube.com/..."
                                       style="width: 100%; padding: 8px; background: rgba(184, 134, 11, 0.15); border: 2px solid rgba(255, 152, 0, 0.5); border-radius: 8px; color: #FFA500; font-size: 13px; box-shadow: inset 0 0 10px rgba(184, 134, 11, 0.2); transition: all 0.3s ease;" onfocus="this.style.borderColor='rgba(255, 165, 0, 0.8)'; this.style.boxShadow='0 0 15px rgba(255, 165, 0, 0.4)'" onblur="this.style.borderColor='rgba(255, 152, 0, 0.5)'; this.style.boxShadow='inset 0 0 10px rgba(184, 134, 11, 0.2)'">
                            </div>
                            <div>
                                <label style="color: #FFD700; font-weight: bold; display: block; margin-bottom: 5px; text-shadow: 0 0 5px rgba(255, 215, 0, 0.3);">VK Видео:</label>
                                <input type="url" id="vkVideoLink" placeholder="https://vk.com/video..."
                                       style="width: 100%; padding: 8px; background: rgba(184, 134, 11, 0.15); border: 2px solid rgba(87, 119, 161, 0.5); border-radius: 8px; color: #5777a1; font-size: 13px; box-shadow: inset 0 0 10px rgba(184, 134, 11, 0.2); transition: all 0.3s ease;" onfocus="this.style.borderColor='rgba(100, 150, 200, 0.8)'; this.style.boxShadow='0 0 15px rgba(100, 150, 200, 0.4)'" onblur="this.style.borderColor='rgba(87, 119, 161, 0.5)'; this.style.boxShadow='inset 0 0 10px rgba(184, 134, 11, 0.2)'">
                            </div>
                        </div>
                        <div style="background: linear-gradient(135deg, rgba(218, 165, 32, 0.25), rgba(184, 134, 11, 0.15)); padding: 8px 10px; border-radius: 8px; border: 2px solid rgba(255, 215, 0, 0.6); display: flex; align-items: center; box-shadow: 0 0 15px rgba(255, 215, 0, 0.2);">
                            <label style="color: #FFD700; font-weight: bold; display: flex; align-items: center; gap: 8px; cursor: pointer; margin: 0; font-size: 13px; text-shadow: 0 0 5px rgba(255, 215, 0, 0.3);">
                                <input type="checkbox" id="isPrivateMod" checked style="width: 16px; height: 16px; accent-color: #FFD700;" disabled>
                                💎 VIP мод (всегда включено)
                            </label>
                        </div>

                        <!-- Блок загрузки изображений -->
                        <div>
                            <label style="color: #FFD700; font-weight: bold; display: block; margin-bottom: 8px; text-shadow: 0 0 5px rgba(255, 215, 0, 0.3);">Изображения мода (до 4 шт.):</label>
                            <div style="color: #B8860B; font-size: 0.85rem; margin-bottom: 12px; line-height: 1.4; background: rgba(184, 134, 11, 0.1); padding: 8px; border-radius: 6px; border: 1px solid rgba(218, 165, 32, 0.3);">
                                📏 <b>Рекомендуемый размер:</b> 800x600 - 1920x1080 пикселей<br>
                                💾 <b>Максимальный вес:</b> до 5 МБ на файл<br>
                                🎯 <b>Форматы:</b> JPG, PNG, WebP (PNG - для качества, JPG - для сжатия)
                            </div>
                            <div id="mod-image-upload-container" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px;">
                                ${[...Array(4)].map((_, i) => `
                                    <div class="image-upload-slot" style="aspect-ratio: 16/9; border: 2px dashed rgba(218, 165, 32, 0.6); border-radius: 10px; display: flex; align-items: center; justify-content: center; position: relative; background: linear-gradient(135deg, rgba(184, 134, 11, 0.1), rgba(218, 165, 32, 0.05)); transition: all 0.3s ease;" onmouseover="this.style.borderColor='rgba(255, 215, 0, 0.8)'; this.style.boxShadow='0 0 15px rgba(255, 215, 0, 0.3)'" onmouseout="this.style.borderColor='rgba(218, 165, 32, 0.6)'; this.style.boxShadow='none'">
                                        <img id="image-preview-${i}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px; display: none;">
                                        <label for="modImage${i}" style="cursor: pointer; text-align: center; color: #FFD700; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; transition: all 0.3s ease;" onmouseover="this.style.color='#FFF'" onmouseout="this.style.color='#FFD700'">
                                            <span style="font-size: 1.8rem; margin-bottom: 5px; text-shadow: 0 0 10px rgba(255, 215, 0, 0.4);">📷</span>
                                            <span id="image-label-${i}" style="font-size: 0.75rem; text-shadow: 0 0 5px rgba(255, 215, 0, 0.3);">Изобр. ${i + 1}</span>
                                        </label>
                                        <input type="file" id="modImage${i}" accept="image/*" class="mod-image-input" data-index="${i}" style="display: none;" onchange="previewModImage(event)">
                                        <button type="button" id="remove-image-${i}" onclick="removeModImage(${i})"
                                                style="position: absolute; top: 3px; right: 3px; background: linear-gradient(135deg, #f44336, #d32f2f); color: white; border: none; border-radius: 50%; width: 22px; height: 22px; cursor: pointer; display: none; font-weight: bold; font-size: 12px; line-height: 22px; text-align: center; box-shadow: 0 2px 8px rgba(244, 67, 54, 0.4); transition: all 0.3s ease;" onmouseover="this.style.transform='scale(1.1)'; this.style.boxShadow='0 3px 12px rgba(244, 67, 54, 0.6)'" onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 2px 8px rgba(244, 67, 54, 0.4)'">✕</button>
                                    </div>
                                `).join('')}
                            </div>
                        </div>

                        <!-- Ссылка на файл -->
                        <div>
                            <label style="color: #FFD700; font-weight: bold; display: block; margin-bottom: 5px; text-shadow: 0 0 5px rgba(255, 215, 0, 0.3);">С��ылка на фа��л:</label>
                            <input type="url" id="modDownloadUrl" placeholder="https://..." required
                                   style="width: 100%; padding: 10px; background: rgba(184, 134, 11, 0.15); border: 2px solid rgba(0, 204, 255, 0.5); border-radius: 8px; color: #00ccff; font-size: 14px; box-shadow: inset 0 0 10px rgba(184, 134, 11, 0.2); transition: all 0.3s ease;" onfocus="this.style.borderColor='rgba(0, 204, 255, 0.8)'; this.style.boxShadow='0 0 15px rgba(0, 204, 255, 0.4)'" onblur="this.style.borderColor='rgba(0, 204, 255, 0.5)'; this.style.boxShadow='inset 0 0 10px rgba(184, 134, 11, 0.2)'">
                        </div>

                        <div id="admin-uploadProgress" style="display: none; background: linear-gradient(135deg, rgba(218, 165, 32, 0.15), rgba(184, 134, 11, 0.1)); padding: 12px; border-radius: 8px; border: 2px solid rgba(255, 215, 0, 0.5); box-shadow: 0 0 15px rgba(255, 215, 0, 0.2);">
                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                                <span style="color: #FFD700; font-weight: bold; font-size: 13px; text-shadow: 0 0 5px rgba(255, 215, 0, 0.3);">Загрузка...</span>
                                <div style="flex: 1; background: rgba(184, 134, 11, 0.2); height: 8px; border-radius: 4px; overflow: hidden; box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.3);">
                                    <div id="admin-progressBar" style="background: linear-gradient(90deg, #FFD700, #FFA500); height: 100%; width: 0%; transition: width 0.3s ease; box-shadow: 0 0 10px rgba(255, 215, 0, 0.5);"></div>
                                </div>
                            </div>
                            <p id="admin-uploadStatus" style="color: #FFA500; margin: 0; font-size: 12px;"></p>
                        </div>

                        <button type="submit" style="background: linear-gradient(135deg, #B8860B, #DAA520, #FFD700); color: #000; border: 2px solid rgba(255, 215, 0, 0.6); padding: 12px 20px; border-radius: 8px; font-size: 15px; font-weight: bold; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(218, 165, 32, 0.4), inset 0 0 10px rgba(255, 215, 0, 0.2);" onmouseover="this.style.transform='scale(1.03)'; this.style.boxShadow='0 6px 20px rgba(255, 215, 0, 0.6), inset 0 0 15px rgba(255, 215, 0, 0.3)'" onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 4px 15px rgba(218, 165, 32, 0.4), inset 0 0 10px rgba(255, 215, 0, 0.2)'">
                            🚀 ЗАГРУЗИТЬ VIP МОД
                        </button>
                    </form>
                </div>

                <!-- Список загруженных VIP модов -->
                <div style="background: linear-gradient(135deg, rgba(184, 134, 11, 0.1), rgba(218, 165, 32, 0.05)); border: 2px solid rgba(218, 165, 32, 0.4); border-radius: 12px; padding: 18px; box-shadow: 0 0 20px rgba(218, 165, 32, 0.2);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <h5 style="color: #FFD700; margin: 0; font-size: 15px; text-shadow: 0 0 8px rgba(255, 215, 0, 0.4);">💎 Загруженные VIP моды</h5>
                        <button onclick="refreshAdminVipMods()" style="background: linear-gradient(135deg, #DAA520, #B8860B); color: #000; border: 2px solid rgba(255, 215, 0, 0.6); padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: bold; transition: all 0.3s ease; box-shadow: 0 2px 10px rgba(218, 165, 32, 0.4);" onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 4px 15px rgba(255, 215, 0, 0.5)'" onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 2px 10px rgba(218, 165, 32, 0.4)'">🔄 Обновить</button>
                    </div>
                    <div id="vip-mods-for-moderation-list" style="max-height: 500px; overflow-y: auto; overflow-x: hidden;">
                        <div style="text-align: center; color: #FFD700; font-size: 12px; margin: 10px 0;">⏳ Загрузка VIP модов...</div>
                    </div>
                </div>
            </div>
        `;

        // Функция обновления VIP модов
        window.refreshAdminVipMods = async function() {
            console.log('🔄 Обновляем список VIP модов...');

            const container = document.getElementById('vip-mods-for-moderation-list');
            if (!container) {
                console.log('ℹ️ Контейнер VIP модов не найден');
                return;
            }

            container.innerHTML = '<div style="text-align: center; color: #ffd700; font-size: 12px; margin: 10px 0;">⏳ Обновление VIP модов...</div>';

            if (!window.supabase || typeof window.supabase.from !== 'function') {
                console.error('❌ Supabase клиент не инициализирован');
                container.innerHTML = '<p style="color: #f44336; text-align: center;">❌ Ошибка: Supabase клиент не инициализирован.</p>';
                return;
            }

            try {
                // Загружаем ТОЛЬКО VIP моды (is_private = true)
                const { data: mods, error } = await window.supabase
                    .from('mods')
                    .select('*')
                    .eq('is_private', true)
                    .order('created_at', { ascending: false });

                if (error) throw error;

                // Считаем моды по версиям игр
                const fs25Count = mods.filter(m => m.game_version === 'fs25').length;
                const fs22Count = mods.filter(m => m.game_version === 'fs22').length;
                const fs19Count = mods.filter(m => m.game_version === 'fs19').length;
                const totalCount = mods.length;

                // Обновляем заголовок со статистикой
                const headerElement = document.querySelector('#vip-mods-for-moderation-list').previousElementSibling.querySelector('h5');
                if (headerElement) {
                    headerElement.innerHTML = `💎 Загруженные VIP моды <span style="background: rgba(255,215,0,0.2); padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">Всего: ${totalCount}</span> <span style="background: rgba(76,175,80,0.2); padding: 2px 8px; border-radius: 12px; font-size: 0.8rem; margin-left: 5px;">FS25: ${fs25Count}</span> <span style="background: rgba(33,150,243,0.2); padding: 2px 8px; border-radius: 12px; font-size: 0.8rem; margin-left: 5px;">FS22: ${fs22Count}</span> <span style="background: rgba(255,193,7,0.2); padding: 2px 8px; border-radius: 12px; font-size: 0.8rem; margin-left: 5px;">FS19: ${fs19Count}</span>`;
                }

                if (mods.length === 0) {
                    container.innerHTML = '<p style="text-align: center; color: #8892b0;">💎 VIP моды не найдены.</p>';
                    return;
                }

                // Собираем уникальные ID пользователей
                const userIds = [...new Set(mods.map(mod => mod.user_id).filter(id => id))];
                let profiles = {};

                if (userIds.length > 0) {
                    try {
                        const { data: profilesData, error: profilesError } = await window.supabase
                            .from('profiles')
                            .select('id, username')
                            .in('id', userIds);

                        if (!profilesError && profilesData) {
                            profiles = profilesData.reduce((acc, profile) => {
                                acc[profile.id] = profile;
                                return acc;
                            }, {});
                        }
                    } catch (profileError) {
                        console.warn('⚠️ Не удалось загрузить профили:', profileError);
                    }
                }

                let modsHtml = mods.map(mod => {
                    const isApproved = mod.is_approved;
                    const uploaderProfile = profiles[mod.user_id];
                    const uploaderUsername = uploaderProfile?.username || 'Неизвестен';

                    const statusBadge = isApproved
                        ? `<span style="background: #4CAF50; color: white; padding: 3px 8px; border-radius: 12px; font-size: 0.7rem;">Одобрен</span>`
                        : `<span style="background: #ff9800; color: white; padding: 3px 8px; border-radius: 12px; font-size: 0.7rem;">На модерации</span>`;

                    let mainImageUrl = '';
                    if (mod.images && Array.isArray(mod.images) && mod.images.length > 0) {
                        const firstImage = mod.images[0];
                        if (firstImage && typeof firstImage === 'string' && firstImage.trim() !== '') {
                            mainImageUrl = firstImage;
                        } else if (firstImage && typeof firstImage === 'object' && firstImage.url) {
                            mainImageUrl = firstImage.url;
                        }
                    }

                    return `
                        <div class="moderation-mod-card" style="display: flex; flex-direction: column; gap: 15px; background: rgba(255,215,0,0.05); padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #ffd700;">
                            <div style="display: flex; align-items: center; gap: 15px;">
                                ${mainImageUrl ? `<img src="${mainImageUrl}" alt="${mod.name}" style="width: 120px; height: 72px; object-fit: cover; border-radius: 4px;">` : '<div style="width: 120px; height: 72px; background: rgba(255,215,0,0.1); border: 1px solid rgba(255,215,0,0.3); border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #ffd700; font-size: 12px;">📷 Нет изображения</div>'}
                                <div style="flex: 1;">
                                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                                        <h6 style="color: #ffd700; margin: 0; font-size: 1rem;">${mod.name}</h6>
                                        <div style="display: flex; gap: 5px; flex-shrink: 0;">
                                            ${statusBadge}
                                            <span style="background: #ffd700; color: #000; padding: 3px 8px; border-radius: 12px; font-size: 0.7rem;">💎 VIP</span>
                                        </div>
                                    </div>
                                    <p style="margin: 8px 0; font-size: 0.85rem; color: #B8860B;">
                                        Автор модификации: <span style="color: #FFD700;">${mod.mod_author || 'Неизвестен'}</span> |
                                        Игра: <span style="color: #FFD700;">${mod.game_version ? mod.game_version.toUpperCase() : 'Не указана'}</span> |
                                        Категория: <span style="color: #FFD700;">${getRussianCategoryName(mod.category)}</span>
                                    </p>
                                    <p style="margin: 4px 0; font-size: 0.75rem; color: #8892b0;">
                                        📅 Залил мод: <span style="color: #FFD700;">${uploaderUsername}</span> |
                                        Загружено: ${new Date(mod.created_at).toLocaleString('ru-RU', {
                                            day: '2-digit',
                                            month: '2-digit',
                                            year: '2-digit',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </p>
                                </div>
                            </div>
                            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                                ${!isApproved ? `
                                    <button onclick="window.approveMod('${mod.id}')" style="background: #4CAF50; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 0.75rem; font-weight: bold;">✅ Одобрить</button>
                                    <button onclick="window.rejectMod('${mod.id}')" style="background: #f44336; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 0.75rem; font-weight: bold;">❌ Отклонить</button>
                                ` : ''}
                                <button onclick="window.deleteMod('${mod.id}', '${mod.name}')" style="background: #9c27b0; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 0.75rem; font-weight: bold;">🗑️ Удалить</button>
                                <button onclick="window.editVipMod('${mod.id}')" style="background: #2196F3; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 0.75rem; font-weight: bold;">✏️ Редактировать</button>
                            </div>
                        </div>
                    `;
                }).join('');

                container.innerHTML = modsHtml;
                console.log(`✅ VIP моды обновлены: ${mods.length}`);

            } catch (error) {
                console.error('❌ Ошибка обновления VIP модов:', error);
                container.innerHTML = `<p style="color: #f44336; text-align: center;">❌ Ошибка: ${error.message}</p>`;
            }
        };

        // Загружаем VIP моды после создания интерфейса
        setTimeout(() => {
            if (typeof window.refreshAdminVipMods === 'function') {
                window.refreshAdminVipMods();
            }
        }, 100);

        console.log('✅ Интерфейс управления VIP модами загружен');

    } catch (error) {
        console.error('❌ Ошибка загрузки управления VIP модами:', error);
        contentArea.innerHTML = `
            <div style="color: #f44336; padding: 20px; text-align: center;">
                <h4>❌ Ошибка загрузки управления VIP модами</h4>
                <p>${error.message}</p>
            </div>
        `;
    }
};

// Функция для редактирования обычных модов (без VIP чекбокса)
window.editRegularMod = async function(modId) {
    console.log('✏️ Редактирование обычного мода:', modId);

    try {
        const { data: mod, error } = await window.supabase.from('mods').select('*').eq('id', modId).single();
        if (error) throw error;

        const { data: categories } = await window.supabase.from('mod_categories').select('id, name');
        const categoryOptions = categories.filter(cat => cat.id !== 'all').map(cat => `<option value="${cat.id}" ${cat.id === mod.category ? 'selected' : ''}>${cat.name || cat.id}</option>`).join('');

        // Инициализируем массив изображений (сохраняем все 4 слота)
        const rawImages = mod.images || [];
        window.editModImages = [
            rawImages[0] || null,
            rawImages[1] || null,
            rawImages[2] || null,
            rawImages[3] || null
        ].slice(0, 4);
        const existingImagesCount = window.editModImages.filter(img => img && img !== null && img !== '').length;

        const modal = document.createElement('div');
        modal.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(10, 25, 47, 0.95); display: flex; justify-content: center; align-items: center; z-index: 200000; overflow-y: auto; padding: 20px;`;

        modal.innerHTML = `
            <div style="background: linear-gradient(135deg, #1a2f5e, #112240); border: 2px solid #00ccff; border-radius: 15px; padding: 2rem; width: 90%; max-width: 800px; max-height: 90vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid rgba(0,204,255,0.3);">
                    <h3 style="color: #00ccff; margin: 0;">✏️ Редактирование мода</h3>
                    <button onclick="this.closest('div').parentElement.parentElement.remove()" style="background: #f44336; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 16px;">&times;</button>
                </div>
                <form id="editModForm" style="display: grid; gap: 15px;">
                    <div><label style="display: block; color: #00ccff; margin-bottom: 5px; font-weight: bold;">Название мода:</label><input type="text" id="editModName" value="${mod.name}" required style="width: 100%; padding: 10px; border: 2px solid rgba(0,204,255,0.3); background: rgba(10, 25, 47, 0.8); border-radius: 8px; color: white; font-size: 14px;"></div>
                    <div><label style="display: block; color: #00ccff; margin-bottom: 5px; font-weight: bold;">Описание:</label><textarea id="editModDescription" rows="4" required style="width: 100%; padding: 10px; border: 2px solid rgba(0,204,255,0.3); background: rgba(10, 25, 47, 0.8); border-radius: 8px; color: white; font-size: 14px; resize: vertical;">${mod.description || ''}</textarea></div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div><label style="display: block; color: #00ccff; margin-bottom: 5px; font-weight: bold;">Категория:</label><select id="editModCategory" required style="width: 100%; padding: 10px; border: 2px solid rgba(0,204,255,0.3); background: rgba(10, 25, 47, 0.8); border-radius: 8px; color: white; font-size: 14px;">${categoryOptions}</select></div>
                        <div><label style="display: block; color: #00ccff; margin-bottom: 5px; font-weight: bold;">Версия игры:</label><select id="editModGameVersion" required style="width: 100%; padding: 10px; border: 2px solid rgba(0,204,255,0.3); background: rgba(10, 25, 47, 0.8); border-radius: 8px; color: white; font-size: 14px;"><option value="fs25" ${mod.game_version === 'fs25' ? 'selected' : ''}>FS25</option><option value="fs22" ${mod.game_version === 'fs22' ? 'selected' : ''}>FS22</option><option value="fs19" ${mod.game_version === 'fs19' ? 'selected' : ''}>FS19</option></select></div>
                    </div>
                    <div><label style="display: block; color: #00ccff; margin-bottom: 5px; font-weight: bold;">Версия мода:</label><input type="text" id="editModVersion" value="${mod.mod_version || '1.0.0'}" placeholder="1.0.0" style="width: 100%; padding: 10px; border: 2px solid rgba(0,204,255,0.3); background: rgba(10, 25, 47, 0.8); border-radius: 8px; color: white; font-size: 14px;"></div>
                    <div><label style="display: block; color: #00ccff; margin-bottom: 5px; font-weight: bold;">Автор модификации:</label><input type="text" id="editModAuthor" value="${mod.mod_author || ''}" placeholder="Имя автора" style="width: 100%; padding: 10px; border: 2px solid rgba(0,204,255,0.3); background: rgba(10, 25, 47, 0.8); border-radius: 8px; color: white; font-size: 14px;"></div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div><label style="display: block; color: #ff9800; margin-bottom: 5px; font-weight: bold;">YouTube:</label><input type="url" id="editModYoutube" value="${mod.youtube_link || ''}" placeholder="https://youtube.com/..." style="width: 100%; padding: 10px; border: 2px solid rgba(255,152,0,0.3); background: rgba(10, 25, 47, 0.8); border-radius: 8px; color: #ff9800; font-size: 13px;"></div>
                        <div><label style="display: block; color: #5777a1; margin-bottom: 5px; font-weight: bold;">VK Видео:</label><input type="url" id="editModVk" value="${mod.vk_video_link || ''}" placeholder="https://vk.com/video..." style="width: 100%; padding: 10px; border: 2px solid rgba(87,119,161,0.3); background: rgba(10, 25, 47, 0.8); border-radius: 8px; color: #5777a1; font-size: 13px;"></div>
                    </div>
                    <div><label style="display: block; color: #00ccff; margin-bottom: 5px; font-weight: bold;">Ссылка на скачивание:</label><input type="url" id="editModDownloadUrl" value="${mod.download_url || ''}" placeholder="https://..." required style="width: 100%; padding: 10px; border: 2px solid rgba(0,204,255,0.3); background: rgba(10, 25, 47, 0.8); border-radius: 8px; color: white; font-size: 14px;"></div>
                    
                    <!-- Блок изображений -->
                    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(0,204,255,0.3);">
                        <label style="display: block; color: #00ccff; margin-bottom: 10px; font-weight: bold;">📸 Изображения мода (${window.editModImages.filter(img => img && img !== null && img !== '').length}/4):</label>
                        <p style="color: #8892b0; font-size: 0.85rem; margin-bottom: 15px; line-height: 1.4;">📏 <b>Рекомендуемый размер:</b> 800x600 - 1920x1080 пикселей<br>💾 <b>Максимальный вес:</b> до 5 МБ на файл<br>🎯 <b>Форматы:</b> JPG, PNG, WebP<br>🖱️ <b>Перетаскивайте</b> изображения мышкой для смены порядка<br>⚠️ <b>Первое изображение</b> - главное (отображается в карточке мода)</p>
                        <div id="editModImagesContainer" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px;">
                            ${(() => {
                                const hasImageCount = window.editModImages.filter(img => img && img !== null && img !== '').length;
                                return [0, 1, 2, 3].map(i => {
                                    const img = window.editModImages[i];
                                    const hasImage = img && img !== null && img !== '';
                                    const isMain = i === 0;
                                    return `
                                        <div style="background: rgba(0,204,255,0.05); border: 2px dashed ${hasImage ? (isMain ? 'rgba(76,175,80,0.8)' : 'rgba(76,175,80,0.5)') : 'rgba(0,204,255,0.3)'}; border-radius: 10px; padding: 10px; text-align: center; position: relative;"
                                             draggable="${hasImage && !isMain}"
                                             ondragstart="window.handleEditModDragStart(event, ${i})"
                                             ondragover="window.handleEditModDragOver(event)"
                                             ondrop="window.handleEditModDrop(event, ${i})"
                                             ondragenter="this.style.borderColor='#00ff41'; this.style.boxShadow='0 0 15px rgba(0,255,65,0.5)'"
                                             ondragleave="this.style.borderColor='${hasImage ? (isMain ? 'rgba(76,175,80,0.8)' : 'rgba(76,175,80,0.5)') : 'rgba(0,204,255,0.3)'}'; this.style.boxShadow='none'">
                                            ${isMain ? `<div style="position: absolute; top: 5px; right: 5px; background: linear-gradient(135deg, #FFD700, #FFA500); color: #000; padding: 3px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: bold; z-index: 10;">👑 ГЛАВНОЕ</div>` : ''}
                                            <div style="font-size: 0.75rem; color: ${hasImage ? '#4CAF50' : '#00ccff'}; margin-bottom: 8px;">${hasImage ? '🟢' : '⚪'} Основное ${i + 1} - ${hasImage ? 'Занято' : 'Свободно'}</div>
                                            ${hasImage ? `<img src="${img}" id="editModImgPreview${i}" style="width: 100%; aspect-ratio: 16/9; object-fit: cover; border-radius: 6px; margin-bottom: 8px; cursor: ${isMain ? 'default' : 'grab'}; ${isMain ? 'border: 3px solid #4CAF50;' : ''}" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDgwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjgwMCIgaGVpZ2h0PSI0MDAiIGZpbGw9IiMwYTI5MmYiLz48dGV4dCB4PSI0MDAiIHk9IjIwMCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzY0NzQ4OCIgZm9udC1zaXplPSIyNCIgZm9udC1mYW1pbHk9IkFyaWFsIj5ObyBJbWFnZTwvdGV4dD48L3N2Zz4='">` : `<div id="editModImgPlaceholder${i}" style="width: 100%; aspect-ratio: 16/9; background: rgba(0,204,255,0.1); border-radius: 6px; margin-bottom: 8px; display: flex; align-items: center; justify-content: center; color: #00ccff; font-size: 2rem;">📷</div>`}
                                            <label for="editModImg${i}" style="display: inline-block; background: ${hasImage ? 'rgba(0,204,255,0.2)' : 'rgba(0,204,255,0.3)'}; color: #00ccff; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.75rem; transition: all 0.3s ease;" onmouseover="this.style.background='rgba(0,204,255,0.4)'" onmouseout="this.style.background='${hasImage ? 'rgba(0,204,255,0.2)' : 'rgba(0,204,255,0.3)'}'">📷 ${hasImage ? 'Заменить' : 'Загрузить'}</label>
                                            <input type="file" id="editModImg${i}" accept="image/*" style="display: none;" onchange="window.handleEditModImageChange(this, ${i})">
                                            ${hasImage ? `<div style="margin-top: 8px; display: flex; gap: 4px; justify-content: center;"><button type="button" onclick="window.removeEditModImage(${i})" style="background: #f44336; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.7rem;">✕ Удалить</button></div>` : ''}
                                        </div>
                                    `;
                                }).join('');
                            })()}
                        </div>
                    </div>
                    
                    <div style="display: flex; align-items: center; gap: 10px; background: rgba(76,175,80,0.1); padding: 10px; border-radius: 8px; border: 1px solid #4CAF50;"><input type="checkbox" id="editModIsApproved" ${mod.is_approved ? 'checked' : ''} style="width: 16px; height: 16px;"><label for="editModIsApproved" style="color: #4CAF50; font-weight: bold; cursor: pointer;">✅ Одобрен для публикации</label></div>
                    <div style="text-align: center; margin-top: 20px; padding-top: 15px; border-top: 1px solid rgba(0,204,255,0.3);"><button type="submit" style="background: #4CAF50; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: bold; margin-right: 10px;">💾 Сохранить</button><button type="button" onclick="this.closest('div').parentElement.remove()" style="background: #f44336; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: bold;">❌ Отмена</button></div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);
        modal.querySelector('#editModForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const updatedMod = { 
                name: modal.querySelector('#editModName').value.trim(), 
                description: modal.querySelector('#editModDescription').value.trim(), 
                category: modal.querySelector('#editModCategory').value, 
                game_version: modal.querySelector('#editModGameVersion').value, 
                mod_version: modal.querySelector('#editModVersion').value, 
                mod_author: modal.querySelector('#editModAuthor').value.trim(), 
                youtube_link: modal.querySelector('#editModYoutube').value.trim(), 
                vk_video_link: modal.querySelector('#editModVk').value.trim(), 
                download_url: modal.querySelector('#editModDownloadUrl').value.trim(), 
                is_approved: modal.querySelector('#editModIsApproved').checked, 
                is_private: false,
                images: window.editModImages.filter(img => img && img !== null && img !== ''), // Сохраняем только заполненные
                updated_at: new Date().toISOString() 
            };
            const { error } = await window.supabase.from('mods').update(updatedMod).eq('id', modId);
            if (error) { showNotification('❌ Ошибка сохранения: ' + error.message, 'error'); return; }
            showNotification('✅ Мод обновлен!', 'success');
            modal.remove();

            // 🔄 Обновляем админ-панель
            if (typeof window.loadModsForModeration === 'function') {
                window.loadModsForModeration();
            }

            // 🔄 Обновляем моды на основной странице сайта
            const activeCategory = document.querySelector('.category-btn.active')?.textContent.trim() || 'Все';
            const currentGameVersion = document.querySelector('.game-btn.active')?.dataset.game || 'fs25';

            if (typeof window.loadModsByCategory === 'function') {
                window.loadModsByCategory(activeCategory, currentGameVersion);
            }

            // 🔄 Дополнительное обновление через loadModsDirectly
            if (typeof window.loadModsDirectly === 'function') {
                window.loadModsDirectly(activeCategory, currentGameVersion);
            }

            console.log('✅ Интерфейс обновлён без перезагрузки страницы');
        });
    } catch (error) {
        console.error('❌ Ошибка редактирования мода:', error);
        showNotification('❌ Ошибка: ' + error.message, 'error');
    }
};

// Обработка изменения изображения в редакторе
window.handleEditModImageChange = function(input, index) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        // Сохраняем как base64
        window.editModImages[index] = e.target.result;
        
        // Находим контейнер и перерисовываем
        const container = document.getElementById('editModImagesContainer');
        if (container) {
            const hasImageCount = window.editModImages.filter(img => img && img !== null && img !== '').length;
            container.innerHTML = [0, 1, 2, 3].map(i => {
                const img = window.editModImages[i];
                const hasImage = img && img !== null && img !== '';
                return `
                    <div style="background: rgba(0,204,255,0.05); border: 2px dashed ${hasImage ? 'rgba(76,175,80,0.5)' : 'rgba(0,204,255,0.3)'}; border-radius: 10px; padding: 10px; text-align: center;" 
                         draggable="${hasImage}" 
                         ondragstart="window.handleEditModDragStart(event, ${i})" 
                         ondragover="window.handleEditModDragOver(event)" 
                         ondrop="window.handleEditModDrop(event, ${i})"
                         ondragenter="this.style.borderColor='#00ff41'; this.style.boxShadow='0 0 15px rgba(0,255,65,0.5)'"
                         ondragleave="this.style.borderColor='${hasImage ? 'rgba(76,175,80,0.5)' : 'rgba(0,204,255,0.3)'}'; this.style.boxShadow='none'">
                        <div style="font-size: 0.75rem; color: ${hasImage ? '#4CAF50' : '#00ccff'}; margin-bottom: 8px;">${hasImage ? '🟢' : '⚪'} Основное ${i + 1} - ${hasImage ? 'Занято' : 'Свободно'}</div>
                        ${hasImage ? `<img src="${img}" style="width: 100%; aspect-ratio: 16/9; object-fit: cover; border-radius: 6px; margin-bottom: 8px; cursor: grab;">` : `<div style="width: 100%; aspect-ratio: 16/9; background: rgba(0,204,255,0.1); border-radius: 6px; margin-bottom: 8px; display: flex; align-items: center; justify-content: center; color: #00ccff; font-size: 2rem;">📷</div>`}
                        <label for="editModImg${i}" style="display: inline-block; background: ${hasImage ? 'rgba(0,204,255,0.2)' : 'rgba(0,204,255,0.3)'}; color: #00ccff; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.75rem;">📷 ${hasImage ? 'Заменить' : 'Загрузить'}</label>
                        <input type="file" id="editModImg${i}" accept="image/*" style="display: none;" onchange="window.handleEditModImageChange(this, ${i})">
                        ${hasImage ? `<div style="margin-top: 8px; display: flex; gap: 4px; justify-content: center;"><button type="button" onclick="window.removeEditModImage(${i})" style="background: #f44336; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.7rem;">✕ Удалить</button></div>` : ''}
                    </div>
                `;
            }).join('');
            // Обновляем счетчик
            const counter = container.previousElementSibling.previousElementSibling.querySelector('span');
            if (counter) counter.textContent = `(${hasImageCount}/4)`;
        }
    };
    reader.readAsDataURL(file);
};

// Drag-and-Drop функции для перемещения изображений
window.editModDragSrcIndex = null;

window.handleEditModDragStart = function(event, index) {
    window.editModDragSrcIndex = index;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', index);
    event.target.style.opacity = '0.5';
};

window.handleEditModDragOver = function(event) {
    if (event.preventDefault) {
        event.preventDefault();
    }
    event.dataTransfer.dropEffect = 'move';
    return false;
};

window.handleEditModDrop = function(event, targetIndex) {
    if (event.stopPropagation) {
        event.stopPropagation();
    }
    
    const srcIndex = window.editModDragSrcIndex;
    
    // Запрещаем перемещение ИЗ первого слота
    if (srcIndex === 0) {
        alert('⚠️ Первое изображение - главное! Его нельзя перемещать.\n\nВы можете перетаскивать изображения между слотами 2-4.');
        return false;
    }
    
    // Если перемещаем В первый слот - проверяем что там было изображение
    if (targetIndex === 0 && srcIndex !== null) {
        const temp = window.editModImages[srcIndex];
        window.editModImages[srcIndex] = window.editModImages[0];
        window.editModImages[0] = temp;
    } else if (srcIndex !== null && srcIndex !== targetIndex && targetIndex !== 0) {
        // Меняем изображения местами (только для слотов 2-4)
        const temp = window.editModImages[srcIndex];
        window.editModImages[srcIndex] = window.editModImages[targetIndex];
        window.editModImages[targetIndex] = temp;
    }
    
    // Проверяем что первый слот не пустой - если пустой, заполняем первым доступным
    if (!window.editModImages[0] || window.editModImages[0] === null || window.editModImages[0] === '') {
        for (let i = 1; i < 4; i++) {
            if (window.editModImages[i] && window.editModImages[i] !== null && window.editModImages[i] !== '') {
                window.editModImages[0] = window.editModImages[i];
                window.editModImages[i] = null;
                break;
            }
        }
    }
    
    // Перерисовываем контейнер
    const container = document.getElementById('editModImagesContainer');
    if (container) {
        const hasImageCount = window.editModImages.filter(img => img && img !== null && img !== '').length;
        container.innerHTML = [0, 1, 2, 3].map(i => {
            const img = window.editModImages[i];
            const hasImage = img && img !== null && img !== '';
            const isMain = i === 0;
            return `
                <div style="background: rgba(0,204,255,0.05); border: 2px dashed ${hasImage ? (isMain ? 'rgba(76,175,80,0.8)' : 'rgba(76,175,80,0.5)') : 'rgba(0,204,255,0.3)'}; border-radius: 10px; padding: 10px; text-align: center; position: relative;" 
                     draggable="${hasImage && !isMain}" 
                     ondragstart="window.handleEditModDragStart(event, ${i})" 
                     ondragover="window.handleEditModDragOver(event)" 
                     ondrop="window.handleEditModDrop(event, ${i})"
                     ondragenter="this.style.borderColor='#00ff41'; this.style.boxShadow='0 0 15px rgba(0,255,65,0.5)'"
                     ondragleave="this.style.borderColor='${hasImage ? (isMain ? 'rgba(76,175,80,0.8)' : 'rgba(76,175,80,0.5)') : 'rgba(0,204,255,0.3)'}'; this.style.boxShadow='none'">
                    ${isMain ? `<div style="position: absolute; top: 5px; right: 5px; background: linear-gradient(135deg, #FFD700, #FFA500); color: #000; padding: 3px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: bold; z-index: 10;">👑 ГЛАВНОЕ</div>` : ''}
                    <div style="font-size: 0.75rem; color: ${hasImage ? '#4CAF50' : '#00ccff'}; margin-bottom: 8px;">${hasImage ? '🟢' : '⚪'} Основное ${i + 1} - ${hasImage ? 'Занято' : 'Свободно'}</div>
                    ${hasImage ? `<img src="${img}" style="width: 100%; aspect-ratio: 16/9; object-fit: cover; border-radius: 6px; margin-bottom: 8px; cursor: ${isMain ? 'default' : 'grab'}; ${isMain ? 'border: 3px solid #4CAF50;' : ''}">` : `<div style="width: 100%; aspect-ratio: 16/9; background: rgba(0,204,255,0.1); border-radius: 6px; margin-bottom: 8px; display: flex; align-items: center; justify-content: center; color: #00ccff; font-size: 2rem;">📷</div>`}
                    <label for="editModImg${i}" style="display: inline-block; background: ${hasImage ? 'rgba(0,204,255,0.2)' : 'rgba(0,204,255,0.3)'}; color: #00ccff; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.75rem;">📷 ${hasImage ? 'Заменить' : 'Загрузить'}</label>
                    <input type="file" id="editModImg${i}" accept="image/*" style="display: none;" onchange="window.handleEditModImageChange(this, ${i})">
                    ${hasImage ? `<div style="margin-top: 8px; display: flex; gap: 4px; justify-content: center;"><button type="button" onclick="window.removeEditModImage(${i})" style="background: #f44336; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.7rem;">✕ Удалить</button></div>` : ''}
                </div>
            `;
        }).join('');
        const counter = container.previousElementSibling.previousElementSibling.querySelector('span');
        if (counter) counter.textContent = `(${hasImageCount}/4)`;
    }
    
    // Сбрасываем стиль
    const allSlots = document.querySelectorAll('#editModImagesContainer > div');
    allSlots.forEach(slot => {
        slot.style.opacity = '1';
        slot.style.borderColor = '';
        slot.style.boxShadow = '';
    });
    
    return false;
};

// Удаление изображения из редактора
window.removeEditModImage = function(index) {
    if (index < 0 || index >= 4) return;
    window.editModImages[index] = null;
    
    const container = document.getElementById('editModImagesContainer');
    if (container) {
        const hasImageCount = window.editModImages.filter(img => img && img !== null && img !== '').length;
        container.innerHTML = [0, 1, 2, 3].map(i => {
            const img = window.editModImages[i];
            const hasImage = img && img !== null && img !== '';
            return `
                <div style="background: rgba(0,204,255,0.05); border: 2px dashed ${hasImage ? 'rgba(76,175,80,0.5)' : 'rgba(0,204,255,0.3)'}; border-radius: 10px; padding: 10px; text-align: center;" 
                     draggable="${hasImage}" 
                     ondragstart="window.handleEditModDragStart(event, ${i})" 
                     ondragover="window.handleEditModDragOver(event)" 
                     ondrop="window.handleEditModDrop(event, ${i})"
                     ondragenter="this.style.borderColor='#00ff41'; this.style.boxShadow='0 0 15px rgba(0,255,65,0.5)'"
                     ondragleave="this.style.borderColor='${hasImage ? 'rgba(76,175,80,0.5)' : 'rgba(0,204,255,0.3)'}'; this.style.boxShadow='none'">
                    <div style="font-size: 0.75rem; color: ${hasImage ? '#4CAF50' : '#00ccff'}; margin-bottom: 8px;">${hasImage ? '🟢' : '⚪'} Основное ${i + 1} - ${hasImage ? 'Занято' : 'Свободно'}</div>
                    ${hasImage ? `<img src="${img}" style="width: 100%; aspect-ratio: 16/9; object-fit: cover; border-radius: 6px; margin-bottom: 8px; cursor: grab;">` : `<div style="width: 100%; aspect-ratio: 16/9; background: rgba(0,204,255,0.1); border-radius: 6px; margin-bottom: 8px; display: flex; align-items: center; justify-content: center; color: #00ccff; font-size: 2rem;">📷</div>`}
                    <label for="editModImg${i}" style="display: inline-block; background: ${hasImage ? 'rgba(0,204,255,0.2)' : 'rgba(0,204,255,0.3)'}; color: #00ccff; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.75rem;">📷 ${hasImage ? 'Заменить' : 'Загрузить'}</label>
                    <input type="file" id="editModImg${i}" accept="image/*" style="display: none;" onchange="window.handleEditModImageChange(this, ${i})">
                    ${hasImage ? `<div style="margin-top: 8px; display: flex; gap: 4px; justify-content: center;"><button type="button" onclick="window.removeEditModImage(${i})" style="background: #f44336; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.7rem;">✕ Удалить</button></div>` : ''}
                </div>
            `;
        }).join('');
        const counter = container.previousElementSibling.previousElementSibling.querySelector('span');
        if (counter) counter.textContent = `(${hasImageCount}/4)`;
    }
};

// Drag-and-Drop функции для VIP модов
window.editVipModDragSrcIndex = null;

window.handleEditVipModDragStart = function(event, index) {
    window.editVipModDragSrcIndex = index;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', index);
    event.target.style.opacity = '0.5';
};

window.handleEditVipModDragOver = function(event) {
    if (event.preventDefault) {
        event.preventDefault();
    }
    event.dataTransfer.dropEffect = 'move';
    return false;
};

window.handleEditVipModDrop = function(event, targetIndex) {
    if (event.stopPropagation) {
        event.stopPropagation();
    }
    
    const srcIndex = window.editVipModDragSrcIndex;
    
    // Запрещаем перемещение ИЗ первого слота
    if (srcIndex === 0) {
        alert('⚠️ Первое изображение - главное! Его нельзя перемещать.\n\nВы можете перетаскивать изображения между слотами 2-4.');
        return false;
    }
    
    // Если перемещаем В первый слот
    if (targetIndex === 0 && srcIndex !== null) {
        const temp = window.editModImages[srcIndex];
        window.editModImages[srcIndex] = window.editModImages[0];
        window.editModImages[0] = temp;
    } else if (srcIndex !== null && srcIndex !== targetIndex && targetIndex !== 0) {
        // Меняем изображения местами (только для слотов 2-4)
        const temp = window.editModImages[srcIndex];
        window.editModImages[srcIndex] = window.editModImages[targetIndex];
        window.editModImages[targetIndex] = temp;
    }
    
    // Проверяем что первый слот не пустой - если пустой, заполняем первым доступным
    if (!window.editModImages[0] || window.editModImages[0] === null || window.editModImages[0] === '') {
        for (let i = 1; i < 4; i++) {
            if (window.editModImages[i] && window.editModImages[i] !== null && window.editModImages[i] !== '') {
                window.editModImages[0] = window.editModImages[i];
                window.editModImages[i] = null;
                break;
            }
        }
    }
    
    const container = document.getElementById('editVipModImagesContainer');
    if (container) {
        const hasImageCount = window.editModImages.filter(img => img && img !== null && img !== '').length;
        container.innerHTML = [0, 1, 2, 3].map(i => {
            const img = window.editModImages[i];
            const hasImage = img && img !== null && img !== '';
            const isMain = i === 0;
            return `
                <div style="background: rgba(255,215,0,0.05); border: 2px dashed ${hasImage ? (isMain ? 'rgba(255,215,0,0.8)' : 'rgba(255,215,0,0.5)') : 'rgba(218,165,32,0.4)'}; border-radius: 10px; padding: 10px; text-align: center; position: relative;" 
                     draggable="${hasImage && !isMain}" 
                     ondragstart="window.handleEditVipModDragStart(event, ${i})" 
                     ondragover="window.handleEditVipModDragOver(event)" 
                     ondrop="window.handleEditVipModDrop(event, ${i})"
                     ondragenter="this.style.borderColor='#ffd700'; this.style.boxShadow='0 0 15px rgba(255,215,0,0.5)'"
                     ondragleave="this.style.borderColor='${hasImage ? (isMain ? 'rgba(255,215,0,0.8)' : 'rgba(255,215,0,0.5)') : 'rgba(218,165,32,0.4)'}'; this.style.boxShadow='none'">
                    ${isMain ? `<div style="position: absolute; top: 5px; right: 5px; background: linear-gradient(135deg, #FFD700, #FFA500); color: #000; padding: 3px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: bold; z-index: 10;">👑 ГЛАВНОЕ</div>` : ''}
                    <div style="font-size: 0.75rem; color: ${hasImage ? '#FFD700' : '#B8860B'}; margin-bottom: 8px;">${hasImage ? '🟢' : '⚪'} Основное ${i + 1} - ${hasImage ? 'Занято' : 'Свободно'}</div>
                    ${hasImage ? `<img src="${img}" style="width: 100%; aspect-ratio: 16/9; object-fit: cover; border-radius: 6px; margin-bottom: 8px; cursor: ${isMain ? 'default' : 'grab'}; ${isMain ? 'border: 3px solid #FFD700;' : ''}">` : `<div style="width: 100%; aspect-ratio: 16/9; background: rgba(255,215,0,0.1); border-radius: 6px; margin-bottom: 8px; display: flex; align-items: center; justify-content: center; color: #FFD700; font-size: 2rem;">📷</div>`}
                    <label for="editVipModImg${i}" style="display: inline-block; background: ${hasImage ? 'rgba(255,215,0,0.2)' : 'rgba(218,165,32,0.3)'}; color: #FFD700; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.75rem; text-shadow: 0 0 5px rgba(255,215,0,0.3);">📷 ${hasImage ? 'Заменить' : 'Загрузить'}</label>
                    <input type="file" id="editVipModImg${i}" accept="image/*" style="display: none;" onchange="window.handleEditVipModImageChange(this, ${i})">
                    ${hasImage ? `<div style="margin-top: 8px; display: flex; gap: 4px; justify-content: center;"><button type="button" onclick="window.removeEditVipModImage(${i})" style="background: #f44336; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.7rem;">✕ Удалить</button></div>` : ''}
                </div>
            `;
        }).join('');
        const counter = container.previousElementSibling.previousElementSibling.querySelector('span');
        if (counter) counter.textContent = `(${hasImageCount}/4)`;
    }
    
    const allSlots = document.querySelectorAll('#editVipModImagesContainer > div');
    allSlots.forEach(slot => {
        slot.style.opacity = '1';
        slot.style.borderColor = '';
        slot.style.boxShadow = '';
    });
    
    return false;
};

// Перемещение изображения влево
window.moveEditModImageLeft = function(index) {
    if (index <= 0 || !window.editModImages) return;
    // Проверяем что есть хотя бы 2 изображения
    const hasImageCount = window.editModImages.filter(img => img && img !== null && img !== '').length;
    if (hasImageCount < 2) return; // Нельзя перемещать если меньше 2 изображений
    
    const temp = window.editModImages[index];
    window.editModImages[index] = window.editModImages[index - 1];
    window.editModImages[index - 1] = temp;
    // Перерисовываем весь контейнер
    const container = document.getElementById('editModImagesContainer');
    if (container) {
        const hasImage = window.editModImages.filter(img => img && img !== null && img !== '').length;
        container.innerHTML = [0, 1, 2, 3].map(i => {
            const img = window.editModImages[i];
            const hasImg = img && img !== null && img !== '';
            return `
                <div style="background: rgba(0,204,255,0.05); border: 2px dashed ${hasImg ? 'rgba(76,175,80,0.5)' : 'rgba(0,204,255,0.3)'}; border-radius: 10px; padding: 10px; text-align: center;">
                    <div style="font-size: 0.75rem; color: ${hasImg ? '#4CAF50' : '#00ccff'}; margin-bottom: 8px;">${hasImg ? '🟢' : '⚪'} Основное ${i + 1} - ${hasImg ? 'Занято' : 'Свободно'}</div>
                    ${hasImg ? `<img src="${img}" style="width: 100%; aspect-ratio: 16/9; object-fit: cover; border-radius: 6px; margin-bottom: 8px;">` : `<div style="width: 100%; aspect-ratio: 16/9; background: rgba(0,204,255,0.1); border-radius: 6px; margin-bottom: 8px; display: flex; align-items: center; justify-content: center; color: #00ccff; font-size: 2rem;">📷</div>`}
                    <div style="display: flex; gap: 4px; justify-content: center; margin-bottom: 8px;">
                        ${hasImage >= 2 && i > 0 ? `<button type="button" onclick="window.moveEditModImageLeft(${i})" style="background: rgba(0,204,255,0.2); color: #00ccff; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">←</button>` : '<span style="width: 28px;"></span>'}
                        ${hasImage >= 2 && i < 3 ? `<button type="button" onclick="window.moveEditModImageRight(${i})" style="background: rgba(0,204,255,0.2); color: #00ccff; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">→</button>` : '<span style="width: 28px;"></span>'}
                    </div>
                    <label for="editModImg${i}" style="display: inline-block; background: ${hasImg ? 'rgba(0,204,255,0.2)' : 'rgba(0,204,255,0.3)'}; color: #00ccff; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.75rem;">📷 ${hasImg ? 'Заменить' : 'Загрузить'}</label>
                    <input type="file" id="editModImg${i}" accept="image/*" style="display: none;" onchange="window.handleEditModImageChange(this, ${i})">
                    ${hasImg ? `<div style="margin-top: 8px; display: flex; gap: 4px; justify-content: center;"><button type="button" onclick="window.removeEditModImage(${i})" style="background: #f44336; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.7rem;">✕ Удалить</button></div>` : ''}
                </div>
            `;
        }).join('');
        // Обновляем счетчик
        const counter = container.previousElementSibling.previousElementSibling.querySelector('span');
        if (counter) counter.textContent = `(${hasImage}/4)`;
    }
};

// Перемещение изображения вправо
window.moveEditModImageRight = function(index) {
    if (index >= 3 || !window.editModImages) return;
    // Проверяем что есть хотя бы 2 изображения
    const hasImageCount = window.editModImages.filter(img => img && img !== null && img !== '').length;
    if (hasImageCount < 2) return; // Нельзя перемещать если меньше 2 изображений
    
    const temp = window.editModImages[index];
    window.editModImages[index] = window.editModImages[index + 1];
    window.editModImages[index + 1] = temp;
    // Перерисовываем весь контейнер
    const container = document.getElementById('editModImagesContainer');
    if (container) {
        const hasImage = window.editModImages.filter(img => img && img !== null && img !== '').length;
        container.innerHTML = [0, 1, 2, 3].map(i => {
            const img = window.editModImages[i];
            const hasImg = img && img !== null && img !== '';
            return `
                <div style="background: rgba(0,204,255,0.05); border: 2px dashed ${hasImg ? 'rgba(76,175,80,0.5)' : 'rgba(0,204,255,0.3)'}; border-radius: 10px; padding: 10px; text-align: center;">
                    <div style="font-size: 0.75rem; color: ${hasImg ? '#4CAF50' : '#00ccff'}; margin-bottom: 8px;">${hasImg ? '🟢' : '⚪'} Основное ${i + 1} - ${hasImg ? 'Занято' : 'Свободно'}</div>
                    ${hasImg ? `<img src="${img}" style="width: 100%; aspect-ratio: 16/9; object-fit: cover; border-radius: 6px; margin-bottom: 8px;">` : `<div style="width: 100%; aspect-ratio: 16/9; background: rgba(0,204,255,0.1); border-radius: 6px; margin-bottom: 8px; display: flex; align-items: center; justify-content: center; color: #00ccff; font-size: 2rem;">📷</div>`}
                    <div style="display: flex; gap: 4px; justify-content: center; margin-bottom: 8px;">
                        ${hasImage >= 2 && i > 0 ? `<button type="button" onclick="window.moveEditModImageLeft(${i})" style="background: rgba(0,204,255,0.2); color: #00ccff; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">←</button>` : '<span style="width: 28px;"></span>'}
                        ${hasImage >= 2 && i < 3 ? `<button type="button" onclick="window.moveEditModImageRight(${i})" style="background: rgba(0,204,255,0.2); color: #00ccff; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">→</button>` : '<span style="width: 28px;"></span>'}
                    </div>
                    <label for="editModImg${i}" style="display: inline-block; background: ${hasImg ? 'rgba(0,204,255,0.2)' : 'rgba(0,204,255,0.3)'}; color: #00ccff; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.75rem;">📷 ${hasImg ? 'Заменить' : 'Загрузить'}</label>
                    <input type="file" id="editModImg${i}" accept="image/*" style="display: none;" onchange="window.handleEditModImageChange(this, ${i})">
                    ${hasImg ? `<div style="margin-top: 8px; display: flex; gap: 4px; justify-content: center;"><button type="button" onclick="window.removeEditModImage(${i})" style="background: #f44336; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.7rem;">✕ Удалить</button></div>` : ''}
                </div>
            `;
        }).join('');
        const counter = container.previousElementSibling.previousElementSibling.querySelector('span');
        if (counter) counter.textContent = `(${hasImage}/4)`;
    }
};

// Функция для редактирования VIP модов (с автоматическим VIP статусом)
window.editVipMod = async function(modId) {
    console.log('👑 Редактирование VIP мода:', modId);

    try {
        const { data: mod, error } = await window.supabase.from('mods').select('*').eq('id', modId).single();
        if (error) throw error;

        const { data: categories } = await window.supabase.from('mod_categories').select('id, name');
        const categoryOptions = categories.filter(cat => cat.id !== 'all').map(cat => `<option value="${cat.id}" ${cat.id === mod.category ? 'selected' : ''}>${cat.name || cat.id}</option>`).join('');

        // Инициализируем массив изображений (сохраняем все 4 слота)
        const rawImages = mod.images || [];
        window.editModImages = [
            rawImages[0] || null,
            rawImages[1] || null,
            rawImages[2] || null,
            rawImages[3] || null
        ].slice(0, 4);

        const modal = document.createElement('div');
        modal.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(10, 25, 47, 0.95); display: flex; justify-content: center; align-items: center; z-index: 200000; overflow-y: auto; padding: 20px;`;

        modal.innerHTML = `
            <div style="background: linear-gradient(135deg, rgba(184, 134, 11, 0.2), rgba(218, 165, 32, 0.1)); border: 2px solid rgba(255, 215, 0, 0.5); border-radius: 15px; padding: 2rem; width: 90%; max-width: 800px; max-height: 90vh; overflow-y: auto; box-shadow: 0 0 30px rgba(255, 215, 0, 0.3);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid rgba(255,215,0,0.3);">
                    <h3 style="color: #FFD700; margin: 0; text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);">👑 Редактирование VIP мода</h3>
                    <button onclick="this.closest('div').parentElement.parentElement.remove()" style="background: #f44336; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 16px;">&times;</button>
                </div>
                <form id="editVipModForm" style="display: grid; gap: 15px;">
                    <div><label style="display: block; color: #FFD700; margin-bottom: 5px; font-weight: bold; text-shadow: 0 0 5px rgba(255, 215, 0, 0.3);">Название мода:</label><input type="text" id="editVipModName" value="${mod.name}" required style="width: 100%; padding: 10px; border: 2px solid rgba(218, 165, 32, 0.4); background: rgba(184, 134, 11, 0.15); border-radius: 8px; color: #FFD700; font-size: 14px;"></div>
                    <div><label style="display: block; color: #FFD700; margin-bottom: 5px; font-weight: bold; text-shadow: 0 0 5px rgba(255, 215, 0, 0.3);">Описание:</label><textarea id="editVipModDescription" rows="4" required style="width: 100%; padding: 10px; border: 2px solid rgba(218, 165, 32, 0.4); background: rgba(184, 134, 11, 0.15); border-radius: 8px; color: #FFD700; font-size: 14px; resize: vertical;">${mod.description || ''}</textarea></div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div><label style="display: block; color: #FFD700; margin-bottom: 5px; font-weight: bold; text-shadow: 0 0 5px rgba(255, 215, 0, 0.3);">Категория:</label><select id="editVipModCategory" required style="width: 100%; padding: 10px; border: 2px solid rgba(218, 165, 32, 0.4); background: rgba(184, 134, 11, 0.15); border-radius: 8px; color: #FFD700; font-size: 14px;">${categoryOptions}</select></div>
                        <div><label style="display: block; color: #FFD700; margin-bottom: 5px; font-weight: bold; text-shadow: 0 0 5px rgba(255, 215, 0, 0.3);">Версия игры:</label><select id="editVipModGameVersion" required style="width: 100%; padding: 10px; border: 2px solid rgba(218, 165, 32, 0.4); background: rgba(184, 134, 11, 0.15); border-radius: 8px; color: #FFD700; font-size: 14px;"><option value="fs25" ${mod.game_version === 'fs25' ? 'selected' : ''}>FS25</option><option value="fs22" ${mod.game_version === 'fs22' ? 'selected' : ''}>FS22</option><option value="fs19" ${mod.game_version === 'fs19' ? 'selected' : ''}>FS19</option></select></div>
                    </div>
                    <div><label style="display: block; color: #FFD700; margin-bottom: 5px; font-weight: bold; text-shadow: 0 0 5px rgba(255, 215, 0, 0.3);">Версия мода:</label><input type="text" id="editVipModVersion" value="${mod.mod_version || '1.0.0'}" placeholder="1.0.0" style="width: 100%; padding: 10px; border: 2px solid rgba(218, 165, 32, 0.4); background: rgba(184, 134, 11, 0.15); border-radius: 8px; color: #FFD700; font-size: 14px;"></div>
                    <div><label style="display: block; color: #FFD700; margin-bottom: 5px; font-weight: bold; text-shadow: 0 0 5px rgba(255, 215, 0, 0.3);">Автор модификации:</label><input type="text" id="editVipModAuthor" value="${mod.mod_author || ''}" placeholder="Имя автора" style="width: 100%; padding: 10px; border: 2px solid rgba(218, 165, 32, 0.4); background: rgba(184, 134, 11, 0.15); border-radius: 8px; color: #FFD700; font-size: 14px;"></div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div><label style="display: block; color: #FFA500; margin-bottom: 5px; font-weight: bold; text-shadow: 0 0 5px rgba(255, 165, 0, 0.3);">YouTube:</label><input type="url" id="editVipModYoutube" value="${mod.youtube_link || ''}" placeholder="https://youtube.com/..." style="width: 100%; padding: 10px; border: 2px solid rgba(255,152,0,0.5); background: rgba(184, 134, 11, 0.15); border-radius: 8px; color: #FFA500; font-size: 13px;"></div>
                        <div><label style="display: block; color: #5777a1; margin-bottom: 5px; font-weight: bold;">VK Видео:</label><input type="url" id="editVipModVk" value="${mod.vk_video_link || ''}" placeholder="https://vk.com/video..." style="width: 100%; padding: 10px; border: 2px solid rgba(87,119,161,0.5); background: rgba(184, 134, 11, 0.15); border-radius: 8px; color: #5777a1; font-size: 13px;"></div>
                    </div>
                    <div><label style="display: block; color: #FFD700; margin-bottom: 5px; font-weight: bold; text-shadow: 0 0 5px rgba(255, 215, 0, 0.3);">Ссылка на скачивание:</label><input type="url" id="editVipModDownloadUrl" value="${mod.download_url || ''}" placeholder="https://..." required style="width: 100%; padding: 10px; border: 2px solid rgba(0,204,255,0.5); background: rgba(184, 134, 11, 0.15); border-radius: 8px; color: #00ccff; font-size: 14px;"></div>
                    
                    <!-- Блок изображений VIP -->
                    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255,215,0,0.3);">
                        <label style="display: block; color: #FFD700; margin-bottom: 10px; font-weight: bold; text-shadow: 0 0 5px rgba(255, 215, 0, 0.3);">📸 Изображения мода (${window.editModImages.filter(img => img && img !== null && img !== '').length}/4):</label>
                        <p style="color: #B8860B; font-size: 0.85rem; margin-bottom: 15px; line-height: 1.4;">📏 <b>Рекомендуемый размер:</b> 800x600 - 1920x1080 пикселей<br>💾 <b>Максимальный вес:</b> до 5 МБ на файл<br>🎯 <b>Форматы:</b> JPG, PNG, WebP<br>🖱️ <b>Перетаскивайте</b> изображения мышкой для смены порядка<br>⚠️ <b>Первое изображение</b> - главное (отображается в карточке мода)</p>
                        <div id="editVipModImagesContainer" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px;">
                            ${(() => {
                                const hasImageCount = window.editModImages.filter(img => img && img !== null && img !== '').length;
                                return [0, 1, 2, 3].map(i => {
                                    const img = window.editModImages[i];
                                    const hasImage = img && img !== null && img !== '';
                                    const isMain = i === 0;
                                    return `
                                        <div style="background: rgba(255,215,0,0.05); border: 2px dashed ${hasImage ? (isMain ? 'rgba(255,215,0,0.8)' : 'rgba(255,215,0,0.5)') : 'rgba(218,165,32,0.4)'}; border-radius: 10px; padding: 10px; text-align: center; position: relative;" 
                                             draggable="${hasImage && !isMain}" 
                                             ondragstart="window.handleEditVipModDragStart(event, ${i})" 
                                             ondragover="window.handleEditVipModDragOver(event)" 
                                             ondrop="window.handleEditVipModDrop(event, ${i})"
                                             ondragenter="this.style.borderColor='#ffd700'; this.style.boxShadow='0 0 15px rgba(255,215,0,0.5)'"
                                             ondragleave="this.style.borderColor='${hasImage ? (isMain ? 'rgba(255,215,0,0.8)' : 'rgba(255,215,0,0.5)') : 'rgba(218,165,32,0.4)'}'; this.style.boxShadow='none'">
                                            ${isMain ? `<div style="position: absolute; top: 5px; right: 5px; background: linear-gradient(135deg, #FFD700, #FFA500); color: #000; padding: 3px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: bold; z-index: 10;">👑 ГЛАВНОЕ</div>` : ''}
                                            <div style="font-size: 0.75rem; color: ${hasImage ? '#FFD700' : '#B8860B'}; margin-bottom: 8px;">${hasImage ? '🟢' : '⚪'} Основное ${i + 1} - ${hasImage ? 'Занято' : 'Свободно'}</div>
                                            ${hasImage ? `<img src="${img}" id="editVipModImgPreview${i}" style="width: 100%; aspect-ratio: 16/9; object-fit: cover; border-radius: 6px; margin-bottom: 8px; cursor: ${isMain ? 'default' : 'grab'}; ${isMain ? 'border: 3px solid #FFD700;' : ''}" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDgwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjgwMCIgaGVpZ2h0PSI0MDAiIGZpbGw9IiMwYTI5MmYiLz48dGV4dCB4PSI0MDAiIHk9IjIwMCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzY0NzQ4OCIgZm9udC1zaXplPSIyNCIgZm9udC1mYW1pbHk9IkFyaWFsIj5ObyBJbWFnZTwvdGV4dD48L3N2Zz4='">` : `<div id="editVipModImgPlaceholder${i}" style="width: 100%; aspect-ratio: 16/9; background: rgba(255,215,0,0.1); border-radius: 6px; margin-bottom: 8px; display: flex; align-items: center; justify-content: center; color: #FFD700; font-size: 2rem;">📷</div>`}
                                            <label for="editVipModImg${i}" style="display: inline-block; background: ${hasImage ? 'rgba(255,215,0,0.2)' : 'rgba(218,165,32,0.3)'}; color: #FFD700; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.75rem; transition: all 0.3s ease; text-shadow: 0 0 5px rgba(255,215,0,0.3);" onmouseover="this.style.background='rgba(255,215,0,0.4)'" onmouseout="this.style.background='${hasImage ? 'rgba(255,215,0,0.2)' : 'rgba(218,165,32,0.3)'}'">📷 ${hasImage ? 'Заменить' : 'Загрузить'}</label>
                                            <input type="file" id="editVipModImg${i}" accept="image/*" style="display: none;" onchange="window.handleEditVipModImageChange(this, ${i})">
                                            ${hasImage ? `<div style="margin-top: 8px; display: flex; gap: 4px; justify-content: center;"><button type="button" onclick="window.removeEditVipModImage(${i})" style="background: #f44336; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.7rem;">✕ Удалить</button></div>` : ''}
                                        </div>
                                    `;
                                }).join('');
                            })()}
                        </div>
                    </div>
                    
                    <div style="display: flex; align-items: center; gap: 10px; background: linear-gradient(135deg, rgba(76,175,80,0.15), rgba(0,255,65,0.08)); padding: 10px; border-radius: 8px; border: 2px solid rgba(76,175,80,0.4);"><input type="checkbox" id="editVipModIsApproved" ${mod.is_approved ? 'checked' : ''} style="width: 16px; height: 16px; accent-color: #4CAF50;"><label for="editVipModIsApproved" style="color: #4CAF50; font-weight: bold; cursor: pointer;">✅ Одобрен для публикации</label></div>
                    <div style="display: flex; align-items: center; gap: 10px; background: linear-gradient(135deg, rgba(255,215,0,0.2), rgba(218,165,32,0.15)); padding: 10px; border-radius: 8px; border: 2px solid rgba(255,215,0,0.6); box-shadow: 0 0 15px rgba(255,215,0,0.3);"><input type="checkbox" disabled checked style="width: 16px; height: 16px; accent-color: #FFD700;"><label style="color: #FFD700; font-weight: bold; cursor: default; text-shadow: 0 0 5px rgba(255,215,0,0.3);">💎 VIP мод (автоматически)</label></div>
                    <div style="text-align: center; margin-top: 20px; padding-top: 15px; border-top: 1px solid rgba(255,215,0,0.3);"><button type="submit" style="background: linear-gradient(135deg, #B8860B, #DAA520, #FFD700); color: #000; border: 2px solid rgba(255,215,0,0.6); padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: bold; margin-right: 10px; box-shadow: 0 4px 15px rgba(218,165,32,0.4);" onmouseover="this.style.transform='scale(1.03)'" onmouseout="this.style.transform='scale(1)'">💾 Сохранить</button><button type="button" onclick="this.closest('div').parentElement.remove()" style="background: #f44336; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: bold;">❌ Отмена</button></div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);
        modal.querySelector('#editVipModForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const updatedMod = { 
                name: modal.querySelector('#editVipModName').value.trim(), 
                description: modal.querySelector('#editVipModDescription').value.trim(), 
                category: modal.querySelector('#editVipModCategory').value, 
                game_version: modal.querySelector('#editVipModGameVersion').value, 
                mod_version: modal.querySelector('#editVipModVersion').value, 
                mod_author: modal.querySelector('#editVipModAuthor').value.trim(), 
                youtube_link: modal.querySelector('#editVipModYoutube').value.trim(), 
                vk_video_link: modal.querySelector('#editVipModVk').value.trim(), 
                download_url: modal.querySelector('#editVipModDownloadUrl').value.trim(), 
                is_approved: modal.querySelector('#editVipModIsApproved').checked, 
                is_private: true,
                images: window.editModImages.filter(img => img && img !== null && img !== ''), // Сохраняем только заполненные
                updated_at: new Date().toISOString() 
            };
            const { error } = await window.supabase.from('mods').update(updatedMod).eq('id', modId);
            if (error) { showNotification('❌ Ошибка сохранения: ' + error.message, 'error'); return; }
            showNotification('✅ VIP мод обновлен!', 'success');
            modal.remove();

            // 🔄 Обновляем админ-панель
            if (typeof window.refreshAdminVipMods === 'function') {
                window.refreshAdminVipMods();
            }

            // 🔄 Обновляем моды на основной странице сайта
            const activeCategory = document.querySelector('.category-btn.active')?.textContent.trim() || 'Все';
            const currentGameVersion = document.querySelector('.game-btn.active')?.dataset.game || 'fs25';

            if (typeof window.loadModsByCategory === 'function') {
                window.loadModsByCategory(activeCategory, currentGameVersion);
            }

            // 🔄 Дополнительное обновление через loadModsDirectly
            if (typeof window.loadModsDirectly === 'function') {
                window.loadModsDirectly(activeCategory, currentGameVersion);
            }

            console.log('✅ VIP мод обновлён! Интерфейс обновлён без перезагрузки.');
        });
    } catch (error) {
        console.error('❌ Ошибка редактирования VIP мода:', error);
        showNotification('❌ Ошибка: ' + error.message, 'error');
    }
};

// Обработка изменения изображения в редакторе VIP
window.handleEditVipModImageChange = function(input, index) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        window.editModImages[index] = e.target.result;
        
        const container = document.getElementById('editVipModImagesContainer');
        if (container) {
            const hasImageCount = window.editModImages.filter(img => img && img !== null && img !== '').length;
            container.innerHTML = [0, 1, 2, 3].map(i => {
                const img = window.editModImages[i];
                const hasImage = img && img !== null && img !== '';
                return `
                    <div style="background: rgba(255,215,0,0.05); border: 2px dashed ${hasImage ? 'rgba(255,215,0,0.5)' : 'rgba(218,165,32,0.4)'}; border-radius: 10px; padding: 10px; text-align: center;" 
                         draggable="${hasImage}" 
                         ondragstart="window.handleEditVipModDragStart(event, ${i})" 
                         ondragover="window.handleEditVipModDragOver(event)" 
                         ondrop="window.handleEditVipModDrop(event, ${i})"
                         ondragenter="this.style.borderColor='#ffd700'; this.style.boxShadow='0 0 15px rgba(255,215,0,0.5)'"
                         ondragleave="this.style.borderColor='${hasImage ? 'rgba(255,215,0,0.5)' : 'rgba(218,165,32,0.4)'}'; this.style.boxShadow='none'">
                        <div style="font-size: 0.75rem; color: ${hasImage ? '#FFD700' : '#B8860B'}; margin-bottom: 8px;">${hasImage ? '🟢' : '⚪'} Основное ${i + 1} - ${hasImage ? 'Занято' : 'Свободно'}</div>
                        ${hasImage ? `<img src="${img}" style="width: 100%; aspect-ratio: 16/9; object-fit: cover; border-radius: 6px; margin-bottom: 8px; cursor: grab;">` : `<div style="width: 100%; aspect-ratio: 16/9; background: rgba(255,215,0,0.1); border-radius: 6px; margin-bottom: 8px; display: flex; align-items: center; justify-content: center; color: #FFD700; font-size: 2rem;">📷</div>`}
                        <label for="editVipModImg${i}" style="display: inline-block; background: ${hasImage ? 'rgba(255,215,0,0.2)' : 'rgba(218,165,32,0.3)'}; color: #FFD700; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.75rem; text-shadow: 0 0 5px rgba(255,215,0,0.3);">📷 ${hasImage ? 'Заменить' : 'Загрузить'}</label>
                        <input type="file" id="editVipModImg${i}" accept="image/*" style="display: none;" onchange="window.handleEditVipModImageChange(this, ${i})">
                        ${hasImage ? `<div style="margin-top: 8px; display: flex; gap: 4px; justify-content: center;"><button type="button" onclick="window.removeEditVipModImage(${i})" style="background: #f44336; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.7rem;">✕ Удалить</button></div>` : ''}
                    </div>
                `;
            }).join('');
            const counter = container.previousElementSibling.previousElementSibling.querySelector('span');
            if (counter) counter.textContent = `(${hasImageCount}/4)`;
        }
    };
    reader.readAsDataURL(file);
};

// Удаление изображения из редактора VIP
window.removeEditVipModImage = function(index) {
    if (index < 0 || index >= 4) return;
    window.editModImages[index] = null;
    
    const container = document.getElementById('editVipModImagesContainer');
    if (container) {
        const hasImageCount = window.editModImages.filter(img => img && img !== null && img !== '').length;
        container.innerHTML = [0, 1, 2, 3].map(i => {
            const img = window.editModImages[i];
            const hasImage = img && img !== null && img !== '';
            return `
                <div style="background: rgba(255,215,0,0.05); border: 2px dashed ${hasImage ? 'rgba(255,215,0,0.5)' : 'rgba(218,165,32,0.4)'}; border-radius: 10px; padding: 10px; text-align: center;" 
                     draggable="${hasImage}" 
                     ondragstart="window.handleEditVipModDragStart(event, ${i})" 
                     ondragover="window.handleEditVipModDragOver(event)" 
                     ondrop="window.handleEditVipModDrop(event, ${i})"
                     ondragenter="this.style.borderColor='#ffd700'; this.style.boxShadow='0 0 15px rgba(255,215,0,0.5)'"
                     ondragleave="this.style.borderColor='${hasImage ? 'rgba(255,215,0,0.5)' : 'rgba(218,165,32,0.4)'}'; this.style.boxShadow='none'">
                    <div style="font-size: 0.75rem; color: ${hasImage ? '#FFD700' : '#B8860B'}; margin-bottom: 8px;">${hasImage ? '🟢' : '⚪'} Основное ${i + 1} - ${hasImage ? 'Занято' : 'Свободно'}</div>
                    ${hasImage ? `<img src="${img}" style="width: 100%; aspect-ratio: 16/9; object-fit: cover; border-radius: 6px; margin-bottom: 8px; cursor: grab;">` : `<div style="width: 100%; aspect-ratio: 16/9; background: rgba(255,215,0,0.1); border-radius: 6px; margin-bottom: 8px; display: flex; align-items: center; justify-content: center; color: #FFD700; font-size: 2rem;">📷</div>`}
                    <label for="editVipModImg${i}" style="display: inline-block; background: ${hasImage ? 'rgba(255,215,0,0.2)' : 'rgba(218,165,32,0.3)'}; color: #FFD700; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.75rem; text-shadow: 0 0 5px rgba(255,215,0,0.3);">📷 ${hasImage ? 'Заменить' : 'Загрузить'}</label>
                    <input type="file" id="editVipModImg${i}" accept="image/*" style="display: none;" onchange="window.handleEditVipModImageChange(this, ${i})">
                    ${hasImage ? `<div style="margin-top: 8px; display: flex; gap: 4px; justify-content: center;"><button type="button" onclick="window.removeEditVipModImage(${i})" style="background: #f44336; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.7rem;">✕ Удалить</button></div>` : ''}
                </div>
            `;
        }).join('');
        const counter = container.previousElementSibling.previousElementSibling.querySelector('span');
        if (counter) counter.textContent = `(${hasImageCount}/4)`;
    }
};

// Перемещение изображения влево (VIP)
window.moveEditVipModImageLeft = function(index) {
    if (index <= 0 || !window.editModImages) return;
    // Проверяем что есть хотя бы 2 изображения
    const hasImageCount = window.editModImages.filter(img => img && img !== null && img !== '').length;
    if (hasImageCount < 2) return; // Нельзя перемещать если меньше 2 изображений
    
    const temp = window.editModImages[index];
    window.editModImages[index] = window.editModImages[index - 1];
    window.editModImages[index - 1] = temp;
    // Перерисовываем весь контейнер
    const container = document.getElementById('editVipModImagesContainer');
    if (container) {
        const hasImage = window.editModImages.filter(img => img && img !== null && img !== '').length;
        container.innerHTML = [0, 1, 2, 3].map(i => {
            const img = window.editModImages[i];
            const hasImg = img && img !== null && img !== '';
            return `
                <div style="background: rgba(255,215,0,0.05); border: 2px dashed ${hasImg ? 'rgba(255,215,0,0.5)' : 'rgba(218,165,32,0.4)'}; border-radius: 10px; padding: 10px; text-align: center;">
                    <div style="font-size: 0.75rem; color: ${hasImg ? '#FFD700' : '#B8860B'}; margin-bottom: 8px;">${hasImg ? '🟢' : '⚪'} Основное ${i + 1} - ${hasImg ? 'Занято' : 'Свободно'}</div>
                    ${hasImg ? `<img src="${img}" style="width: 100%; aspect-ratio: 16/9; object-fit: cover; border-radius: 6px; margin-bottom: 8px;">` : `<div style="width: 100%; aspect-ratio: 16/9; background: rgba(255,215,0,0.1); border-radius: 6px; margin-bottom: 8px; display: flex; align-items: center; justify-content: center; color: #FFD700; font-size: 2rem;">📷</div>`}
                    <div style="display: flex; gap: 4px; justify-content: center; margin-bottom: 8px;">
                        ${hasImage >= 2 && i > 0 ? `<button type="button" onclick="window.moveEditVipModImageLeft(${i})" style="background: rgba(255,215,0,0.2); color: #FFD700; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.9rem; text-shadow: 0 0 5px rgba(255,215,0,0.3);">←</button>` : '<span style="width: 28px;"></span>'}
                        ${hasImage >= 2 && i < 3 ? `<button type="button" onclick="window.moveEditVipModImageRight(${i})" style="background: rgba(255,215,0,0.2); color: #FFD700; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.9rem; text-shadow: 0 0 5px rgba(255,215,0,0.3);">→</button>` : '<span style="width: 28px;"></span>'}
                    </div>
                    <label for="editVipModImg${i}" style="display: inline-block; background: ${hasImg ? 'rgba(255,215,0,0.2)' : 'rgba(218,165,32,0.3)'}; color: #FFD700; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.75rem; text-shadow: 0 0 5px rgba(255,215,0,0.3);">📷 ${hasImg ? 'Заменить' : 'Загрузить'}</label>
                    <input type="file" id="editVipModImg${i}" accept="image/*" style="display: none;" onchange="window.handleEditVipModImageChange(this, ${i})">
                    ${hasImg ? `<div style="margin-top: 8px; display: flex; gap: 4px; justify-content: center;"><button type="button" onclick="window.removeEditVipModImage(${i})" style="background: #f44336; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.7rem;">✕ Удалить</button></div>` : ''}
                </div>
            `;
        }).join('');
        const counter = container.previousElementSibling.previousElementSibling.querySelector('span');
        if (counter) counter.textContent = `(${hasImage}/4)`;
    }
};

// Перемещение изображения вправо (VIP)
window.moveEditVipModImageRight = function(index) {
    if (index >= 3 || !window.editModImages) return;
    // Проверяем что есть хотя бы 2 изображения
    const hasImageCount = window.editModImages.filter(img => img && img !== null && img !== '').length;
    if (hasImageCount < 2) return; // Нельзя перемещать если меньше 2 изображений
    
    const temp = window.editModImages[index];
    window.editModImages[index] = window.editModImages[index + 1];
    window.editModImages[index + 1] = temp;
    // Перерисовываем весь контейнер
    const container = document.getElementById('editVipModImagesContainer');
    if (container) {
        const hasImage = window.editModImages.filter(img => img && img !== null && img !== '').length;
        container.innerHTML = [0, 1, 2, 3].map(i => {
            const img = window.editModImages[i];
            const hasImg = img && img !== null && img !== '';
            return `
                <div style="background: rgba(255,215,0,0.05); border: 2px dashed ${hasImg ? 'rgba(255,215,0,0.5)' : 'rgba(218,165,32,0.4)'}; border-radius: 10px; padding: 10px; text-align: center;">
                    <div style="font-size: 0.75rem; color: ${hasImg ? '#FFD700' : '#B8860B'}; margin-bottom: 8px;">${hasImg ? '🟢' : '⚪'} Основное ${i + 1} - ${hasImg ? 'Занято' : 'Свободно'}</div>
                    ${hasImg ? `<img src="${img}" style="width: 100%; aspect-ratio: 16/9; object-fit: cover; border-radius: 6px; margin-bottom: 8px;">` : `<div style="width: 100%; aspect-ratio: 16/9; background: rgba(255,215,0,0.1); border-radius: 6px; margin-bottom: 8px; display: flex; align-items: center; justify-content: center; color: #FFD700; font-size: 2rem;">📷</div>`}
                    <div style="display: flex; gap: 4px; justify-content: center; margin-bottom: 8px;">
                        ${hasImage >= 2 && i > 0 ? `<button type="button" onclick="window.moveEditVipModImageLeft(${i})" style="background: rgba(255,215,0,0.2); color: #FFD700; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.9rem; text-shadow: 0 0 5px rgba(255,215,0,0.3);">←</button>` : '<span style="width: 28px;"></span>'}
                        ${hasImage >= 2 && i < 3 ? `<button type="button" onclick="window.moveEditVipModImageRight(${i})" style="background: rgba(255,215,0,0.2); color: #FFD700; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.9rem; text-shadow: 0 0 5px rgba(255,215,0,0.3);">→</button>` : '<span style="width: 28px;"></span>'}
                    </div>
                    <label for="editVipModImg${i}" style="display: inline-block; background: ${hasImg ? 'rgba(255,215,0,0.2)' : 'rgba(218,165,32,0.3)'}; color: #FFD700; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.75rem; text-shadow: 0 0 5px rgba(255,215,0,0.3);">📷 ${hasImg ? 'Заменить' : 'Загрузить'}</label>
                    <input type="file" id="editVipModImg${i}" accept="image/*" style="display: none;" onchange="window.handleEditVipModImageChange(this, ${i})">
                    ${hasImg ? `<div style="margin-top: 8px; display: flex; gap: 4px; justify-content: center;"><button type="button" onclick="window.removeEditVipModImage(${i})" style="background: #f44336; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.7rem;">✕ Удалить</button></div>` : ''}
                </div>
            `;
        }).join('');
        const counter = container.previousElementSibling.previousElementSibling.querySelector('span');
        if (counter) counter.textContent = `(${hasImage}/4)`;
    }
};

// Функция для показа модального окна с ошибкой формата файла
function showFormatErrorModal(format) {
    // Удаляем существующее модальное окно если есть
    const existingModal = document.getElementById('format-error-modal');
    if (existingModal) {
        existingModal.remove();
    }

    // Создаем модальное окно
    const modal = document.createElement('div');
    modal.id = 'format-error-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        backdrop-filter: blur(5px);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 99999999;
        opacity: 0;
        transition: opacity 0.3s ease;
    `;

    modal.innerHTML = `
        <div style="
            background: linear-gradient(135deg, #1a1a2e, #16213e);
            border: 2px solid #ff4444;
            border-radius: 15px;
            padding: 2rem;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 20px 40px rgba(255, 68, 68, 0.3);
            transform: scale(0.9);
            transition: transform 0.3s ease;
            text-align: center;
        ">
            <div style="
                color: #ff4444;
                font-size: 3rem;
                margin-bottom: 1rem;
                text-shadow: 0 0 10px rgba(255, 68, 68, 0.5);
            ">⚠️</div>

            <h2 style="
                color: #ff4444;
                margin: 0 0 1rem 0;
                font-size: 1.5rem;
                text-shadow: 0 0 10px rgba(255, 68, 68, 0.3);
            ">Неподдерживаемый формат изображения</h2>

            <p style="
                color: #ffffff;
                margin: 1rem 0;
                font-size: 1.1rem;
                line-height: 1.6;
            ">
                Формат <strong style="color: #ff6666; font-size: 1.2rem;">${format}</strong> не поддерживается Supabase Storage.
            </p>

            <div style="
                background: rgba(255, 68, 68, 0.1);
                border: 1px solid rgba(255, 68, 68, 0.3);
                border-radius: 10px;
                padding: 1rem;
                margin: 1.5rem 0;
            ">
                <h3 style="
                    color: #00ff41;
                    margin: 0 0 0.5rem 0;
                    font-size: 1rem;
                ">✅ Поддерживаемые форматы:</h3>
                <div style="
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                    gap: 0.5rem;
                    margin-top: 0.5rem;
                ">
                    <span style="color: #ffffff; background: rgba(0, 255, 65, 0.2); padding: 0.3rem; border-radius: 5px; font-size: 0.9rem;">📸 JPG</span>
                    <span style="color: #ffffff; background: rgba(0, 255, 65, 0.2); padding: 0.3rem; border-radius: 5px; font-size: 0.9rem;">🖼️ PNG</span>
                    <span style="color: #ffffff; background: rgba(0, 255, 65, 0.2); padding: 0.3rem; border-radius: 5px; font-size: 0.9rem;">🎨 WebP</span>
                    <span style="color: #ffffff; background: rgba(0, 255, 65, 0.2); padding: 0.3rem; border-radius: 5px; font-size: 0.9rem;">🎬 GIF</span>
                    <span style="color: #ffffff; background: rgba(0, 255, 65, 0.2); padding: 0.3rem; border-radius: 5px; font-size: 0.9rem;">🎯 SVG</span>
                </div>
            </div>

            <button onclick="this.closest('#format-error-modal').remove()" style="
                background: linear-gradient(135deg, #ff4444, #cc0000);
                color: white;
                border: none;
                border-radius: 8px;
                padding: 0.8rem 2rem;
                font-size: 1rem;
                font-weight: bold;
                cursor: pointer;
                margin-top: 1.5rem;
                transition: all 0.3s ease;
                box-shadow: 0 4px 15px rgba(255, 68, 68, 0.3);
            " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                Понятно
            </button>
        </div>
    `;

    document.body.appendChild(modal);

    // Анимация появления
    setTimeout(() => {
        modal.style.opacity = '1';
        const content = modal.querySelector('div > div');
        if (content) {
            content.style.transform = 'scale(1)';
        }
    }, 10);

    // Автоматическое закрытие при клике на фон
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// Функция предпросмотра изображения мода
window.previewModImage = function(event) {
    const input = event.target;
    const index = input.dataset.index;
    const file = input.files[0];

    if (file) {
        // Проверяем, что файл является изображением
        const extension = file.name.split('.').pop().toLowerCase();
        const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'jfif'];
        const unsupportedFormats = ['avif', 'heic', 'heif', 'tiff', 'tif', 'raw'];
        
        if (unsupportedFormats.includes(extension)) {
            showFormatErrorModal(extension.toUpperCase());
            input.value = ''; // Очищаем инпут
            return;
        }
        
        if (!imageExtensions.includes(extension)) {
            alert(`❌ Файл ${file.name} не является изображением. Пожалуйста, выберите файл с расширением: ${imageExtensions.join(', ')}`);
            input.value = ''; // Очищаем инпут
            return;
        }
        
        console.log(`🖼️ [PREVIEW] Загружается изображение: ${file.name} (${file.type}, ${(file.size / 1024).toFixed(2)} KB)`);
        
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById(`image-preview-${index}`).src = e.target.result;
            document.getElementById(`image-preview-${index}`).style.display = 'block';
            document.getElementById(`remove-image-${index}`).style.display = 'block';
            document.querySelector(`label[for="modImage${index}"]`).style.display = 'none';
        };
        reader.readAsDataURL(file);
    }
};

// Функция удаления изображения мода (только для формы загрузки, не для редактора)
window.removeModImage = function(index) {
    // Проверяем, что это форма загрузки, а не редактор модов
    const modImageInput = document.getElementById(`modImage${index}`);
    if (!modImageInput) {
        // Если это редактор модов, используем функцию из mods.js
        if (typeof window.editModImages !== 'undefined') {
            // Вызываем оригинальную функцию из mods.js
            window.editModImages.splice(index, 1);
            if (typeof window.updateImagesDisplay === 'function') {
                window.updateImagesDisplay();
            }
        }
        return;
    }
    
    // Это форма загруз��и - выполняем оригинальную логику
    modImageInput.value = ''; // Очищаем input
    const preview = document.getElementById(`image-preview-${index}`);
    if (preview) {
        preview.src = '';
        preview.style.display = 'none';
    }
    const removeBtn = document.getElementById(`remove-image-${index}`);
    if (removeBtn) {
        removeBtn.style.display = 'none';
    }
    const label = document.querySelector(`label[for="modImage${index}"]`);
    if (label) {
        label.style.display = 'flex';
    }
};

// Функция для получения русского названия категории
function getRussianCategoryName(categoryId) {
    const categoryMap = {
        'Все': 'Все',
        'vip_mods': 'VIP моды',
        'fs19': 'Farming Simulator 19',
        'fs22': 'Farming Simulator 22',
        'fs25': 'Farming Simulator 25',
        'maps': 'Карты',
        'tractors': 'Тракторы',
        'combines': 'Комбайны',
        'trailers': 'Прицепы',
        'trucks': 'Грузовики',
        'cars': 'Легковые автомобили',
        'railway': 'Ж/д транспорт',
        'loaders': 'Погрузчики и экскаваторы',
        'forestry': 'Лесозаготовка',
        'baling': 'Тюковка',
        'plows': 'Плуги',
        'cultivators': 'Культиваторы',
        'mowers': 'Косилки',
        'sprayers': 'Опрыскиватели',
        'manure_spreaders': 'Навозоразбрасыватели',
        'farm_implements': 'Сельхоз инвентарь',
        'tools': 'Орудия',
        'animals': '🐄 Животноводство',
        'animal_husbandry': '🐄 Животноводство', // Старый ключ из БД
        'equipment': 'Оборудование',
        'buildings': 'Здания',
        'objects': 'Объекты',
        'scripts': 'Ск��ипты',
        'textures': 'Текстуры',
        'scripting': 'Скриптинг',
        'russian_mods': 'Русские моды',
        'russian': 'Русские моды',
        'other_modifications': 'Другие модификации',
        'other': 'Прочее',
        
        // Старые ключи из базы данных для совместимости
        'rail_transport': 'Ж/д транспорт',
        'loaders_excavators': 'Погрузчики и экскаваторы',
        'forestry_equipment': 'Лесозаготовка',
        'baling_equipment': 'Тюковка'
    };
    
    return categoryMap[categoryId] || categoryId;
}

// Глобальная функция для загрузки модова
window.uploadMod = async function(event) {
    console.log('🚀 [admin-panel-fixed] Функция uploadMod вызвана!');
    event.preventDefault();
    
    try {
        const name = document.getElementById('modName').value.trim();
        const category = document.getElementById('modCategory').value;
        const gameVersion = document.getElementById('modGameVersion').value;
        const modVersion = document.getElementById('modVersion').value.trim();
        const downloadUrl = document.getElementById('modDownloadUrl').value.trim();
        const modAuthor = document.getElementById('modAuthor').value.trim(); // Добавляем автора мода
        const description = document.getElementById('modDescription').value.trim();
        const youtubeLink = document.getElementById('youtubeLink').value.trim();
        const vkVideoLink = document.getElementById('vkVideoLink').value.trim();
        const isPrivateMod = document.getElementById('isPrivateMod').checked;
        
        console.log('🔍 [DEBUG] isPrivateMod (checkbox):', isPrivateMod);
        console.log('🔍 [DEBUG] modAuthor:', modAuthor);
        
        if (!name || !downloadUrl) {
            alert('❌ Название и ссылка на файл обязательны');
            return;
        }

        // Показываем прогресс в самом начале
        const progressDiv = document.getElementById('admin-uploadProgress');
        const progressBar = document.getElementById('admin-progressBar');
        const uploadStatus = document.getElementById('admin-uploadStatus');
        
        progressDiv.style.display = 'block';
        uploadStatus.textContent = 'Подготовка данных...';
        progressBar.style.width = '10%';

        // Собираем и загружаем изображения
        const images = [];
        const imageFiles = [];
        
        console.log(`🖼️ [DEBUG] Начинаем сбор изображений из 4 полей...`);
        
        for (let i = 0; i < 4; i++) {
            const preview = document.getElementById(`image-preview-${i}`);
            const input = document.getElementById(`modImage${i}`);
            
            if (input && input.files && input.files[0]) {
                const file = input.files[0];
                const extension = file.name.split('.').pop().toLowerCase();
                const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'jfif'];
                const unsupportedFormats = ['avif', 'heic', 'heif', 'tiff', 'tif', 'raw'];
                
                if (unsupportedFormats.includes(extension)) {
                    showFormatErrorModal(extension.toUpperCase());
                    continue;
                }
                
                if (imageExtensions.includes(extension)) {
                    imageFiles.push(file);
                    console.log(`🖼️ [DEBUG] Добавлено изображение: ${file.name} (${file.type})`);
                } else {
                    console.warn(`⚠️ [DEBUG] Пропущен файл не-изображение: ${file.name} (${file.type})`);
                }
            } else if (preview && preview.src && !preview.src.startsWith('data:')) {
                // Если это уже загруженное изображение (не base64)
                images.push(preview.src);
                console.log(`🖼️ [DEBUG] Добавлено существующее изображение: ${preview.src}`);
            }
        }

        console.log(`🖼️ [DEBUG] Собрано изображений:`, {
            imageFilesCount: imageFiles.length,
            existingImagesCount: images.length,
            imageFiles: imageFiles.map(f => ({ name: f.name, type: f.type, size: f.size })),
            existingImages: images
        });

        // Загружаем новые изображения в Supabase Storage
        if (imageFiles.length > 0) {
            uploadStatus.textContent = 'Загрузка изображений...';
            progressBar.style.width = '20%';
            
            for (let i = 0; i < imageFiles.length; i++) {
                const file = imageFiles[i];
                
                // Получаем правильное расширение файла из имени файла
                const originalExtension = file.name.split('.').pop().toLowerCase();
                const fileName = `mod-${Date.now()}-${i}.${originalExtension}`;
                const filePath = `mod-images/${fileName}`;  // Используем ту же папку, что и в редакторе
                
                console.log(`🖼️ [DEBUG] Обработка файла ${i}:`, {
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    extension: originalExtension
                });
                
                try {
                    // Проверяем аутентификацию перед загрузкой
                    const { data: sessionData } = await window.supabase.auth.getSession();
                    
                    if (!sessionData.session) {
                        console.error('❌ [DEBUG] Пользователь не аутентифицирован');
                        throw new Error('Пользователь не аутентифицирован');
                    }
                    
                    // Используем тот же метод загрузки, что и в редакторе модов
                    const uploadUrl = `https://gtixajbcfxwqrtsdxnif.supabase.co/storage/v1/object/site-assets/${filePath}`;
                    
                    const formData = new FormData();
                    formData.append('file', file, file.name);
                    
                    console.log(`🖼️ [DEBUG] Загрузка через fetch: ${uploadUrl}`);
                    console.log(`🖼️ [DEBUG] Токен: ${sessionData.session.access_token ? 'получен' : 'отсутствует'}`);
                    
                    const response = await fetch(uploadUrl, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${sessionData.session.access_token}`,
                            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhhamJjZnh3cXJ0c2R4bmlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1MDUwMTIsImV4cCI6MjA3NjA4MTAxMn0.T3Wvz0UPTG1O4NFS54PzfyB4sJdNLdiGT9GvnvJKGzw'
                        },
                        body: formData
                    });
                    
                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`HTTP ${response.status}: ${errorText}`);
                    }
                    
                    // Получаем публичную ссылку
                    const { data: publicUrlData } = supabase.storage
                        .from('site-assets')
                        .getPublicUrl(filePath);
                    
                    images.push(publicUrlData.publicUrl);
                    
                    // Обновляем прогресс
                    const progress = 20 + ((i + 1) / imageFiles.length) * 30;
                    progressBar.style.width = `${progress}%`;
                    uploadStatus.textContent = `Загружено изображений: ${i + 1}/${imageFiles.length}`;
                    
                } catch (error) {
                    console.error(`Ошибка загрузки изображения ${i}:`, error);
                }
            }
        }

        console.log(`🖼️ [DEBUG] Результат загрузки изображений:`, {
            totalImageFiles: imageFiles.length,
            uploadedImages: images.length,
            imagesArray: images
        });

        // Получаем ID текущего пользователя
        uploadStatus.textContent = 'Проверка авторизации...';
        progressBar.style.width = '50%';
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            alert('❌ Вы должны быть авторизованы');
            progressDiv.style.display = 'none';
            return;
        }

        uploadStatus.textContent = 'Сохранение мода в базе...';
        progressBar.style.width = '70%';

        const modData = {
            name,
            category,
            game_version: gameVersion,
            mod_version: modVersion || '1.0.0',
            download_url: downloadUrl,
            mod_author: modAuthor, // Добавляем автора мода
            description,
            youtube_link: youtubeLink,
            vk_video_link: vkVideoLink,
            is_private: isPrivateMod,  // Используем только чекбокс VIP
            is_approved: true,
            images: images,
            owner_id: user.id,
            user_id: user.id  // Добавляем user_id чтобы было видно кто залил мод
        };
        
        console.log('🔍 [DEBUG] Данные мода для сохранения:', modData);
        console.log('🖼️ [DEBUG] Изображения для сохранения:', images);
        console.log('🖼️ [DEBUG] Тип images:', typeof images);
        console.log('🖼️ [DEBUG] Длина images:', images.length);

        const { data, error } = await window.supabase
            .from('mods')
            .insert([modData]);

        if (error) {
            console.error('❌ Ошибка загрузки мода:', error);
            alert('❌ Ошибка загрузки мода: ' + error.message);
            progressDiv.style.display = 'none';
            return;
        }

        uploadStatus.textContent = 'Мод успешно загружен!';
        progressBar.style.width = '100%';

        console.log('✅ Мод успешно сохранен в базу данных:', {
            modId: data?.[0]?.id,
            name: modData.name,
            is_private: modData.is_private,
            is_approved: modData.is_approved,
            game_version: modData.game_version,
            category: modData.category
        });

        setTimeout(() => {
            progressDiv.style.display = 'none';
            progressBar.style.width = '0%';
            alert('✅ Мод успешно загружен и теперь виден на сайте!');

            // Очищаем форму
            document.getElementById('uploadModForm').reset();

            // Очищаем изображения
            for (let i = 0; i < 4; i++) {
                window.removeModImage(i);
            }

            // Обновляем списки модов во всех разделах
            console.log('🔄 Обновляем все списки модов...');
            if (typeof window.refreshAdminMods === 'function') {
                console.log('🔄 Обновляем обычные моды...');
                window.refreshAdminMods();
            }
            if (typeof window.refreshAdminVipMods === 'function') {
                console.log('🔄 Обновляем VIP моды...');
                window.refreshAdminVipMods();
            }
            // Обновляем моды на основной странице
            if (typeof window.loadModsForModeration === 'function') {
                console.log('🔄 Обновляем основную страницу...');
                window.loadModsForModeration();
            }
        }, 2000);

    } catch (error) {
        console.error('❌ Ошибка при загрузке мода:', error);
        alert('❌ Ошибка при загрузке мода: ' + error.message);
        document.getElementById('admin-uploadProgress').style.display = 'none';
    }
};

// Псевдоним для совместимости с script.js
window.loadModsForModeration = function() {
    console.log('🔄 [ALIAS] Вызван loadModsForModeration, обновляем оба раздела модов');
    console.log('🔍 [ALIAS] Проверяем window.supabase:', typeof window.supabase);
    console.log('🔍 [ALIAS] Проверяем window.supabase.from:', typeof window.supabase?.from);
    console.log('🔍 [ALIAS] Проверяем window.refreshAdminMods:', typeof window.refreshAdminMods);
    console.log('🔍 [ALIAS] Проверяем window.refreshAdminVipMods:', typeof window.refreshAdminVipMods);

    // Обновляем обычные моды если функция существует
    if (typeof window.refreshAdminMods === 'function') {
        console.log('🔄 Обновляем обычные моды...');
        window.refreshAdminMods();
    } else {
        console.warn('⚠️ refreshAdminMods не найдена');
    }

    // Обновляем VIP моды если функция существует
    if (typeof window.refreshAdminVipMods === 'function') {
        console.log('🔄 Обновляем VIP моды...');
        window.refreshAdminVipMods();
    } else {
        console.warn('⚠️ refreshAdminVipMods не найдена');
    }

    // Также обновляем моды на основной странице
    setTimeout(() => {
        const activeCategory = document.querySelector('.category-btn.active')?.textContent.trim() || 'Все';
        const currentGameVersion = document.querySelector('.game-btn.active')?.dataset.game || 'fs25';
        if (typeof window.loadModsByCategory === 'function') {
            console.log(`🔄 Обновляем основную страницу: категория=${activeCategory}, игра=${currentGameVersion}`);
            window.loadModsByCategory(activeCategory, currentGameVersion);
        }
    }, 500);

    return Promise.resolve();
};

// Резервная функция revokeVipStatus на случай если temp_restore версия не загрузилась
window.revokeVipStatus = async function(userId, username) {
    if (!confirm(`Вы уверены, что хотите лишить VIP-статуса пользователя "${username}"?`)) return;

    try {
        const { data: profile } = await (window.supabase || supabase).from('profiles').select('role').eq('id', userId).single();
        let newRole = profile.role === 'vip' ? 'user' : profile.role;

        const { error } = await (window.supabase || supabase).rpc('update_user_role_direct', {
            p_user_id: userId,
            p_new_role: newRole,
            p_is_vip: false,
            p_vip_expires_at: null,
            p_vip_started_at: null
        });

        if (error) throw error;

        if (typeof showNotification === 'function') {
            showNotification(`✅ Пользователь "${username}" лишен VIP-статуса`, 'success');
        }

        // ✅ СОХРАНЯЕМ ТЕКУЩИЙ РАЗДЕЛ АДМИН-ПАНЕЛИ
        const currentSection = window.currentAdminSection || 'users';
        console.log('💾 Сохранён текущий раздел:', currentSection);

        // ✅ МГНОВЕННАЯ СИНХРОНИЗАЦИЯ: Отправляем событие об изменении VIP статуса
        if (typeof window.sendVipStatusUpdate === 'function') {
            window.sendVipStatusUpdate(userId, false, username);
        }
        
        // ✅ Обновляем список пользователей БЕЗ перезагрузки страницы
        console.log('🔄 Обновляем список пользователей...');
        // НЕ вызываем loadUsersList() чтобы не было перезагрузки
        // Вместо этого просто ждём пока Realtime обновит данные
        
        // ✅ ВОССТАНАВЛИВАЕМ РАЗДЕЛ ЧЕРЕЗ 500мс
        setTimeout(() => {
            console.log('🔄 Восстанавливаем раздел:', currentSection);
            if (typeof selectAdminSection === 'function') {
                selectAdminSection(currentSection, false, true); // forceLoad = true
            }
        }, 500);

    } catch (error) {
        console.error('❌ Ошибка лишения VIP-статуса:', error);
        if (typeof showNotification === 'function') {
            showNotification(`❌ Ошибка: ${error.message}`, 'error');
        }
    }
};

// Удалено - функция revokeVipStatus перенесена в js/temp_restore/js/admin-panel-fixed.js с улучшенной логикой

// Резервная функция deleteOrder на случай если script.js не загрузился
window.deleteOrder = async function(orderId, userName = null, productName = null) {
    if (!orderId) {
        if (typeof showNotification === 'function') {
            showNotification('❌ ID заказа не указан', 'error');
        }
        return;
    }

    const userInfo = userName ? ` от пользователя ${userName}` : '';
    const productInfo = productName ? ` (${productName})` : '';
    
    const isConfirmed = confirm(`⚠️ Вы уверены, что хотите удалить заказ${productInfo}${userInfo}?\n\nЭто действие нельзя отменить.`);
    
    if (!isConfirmed) {
        return;
    }

    try {
        console.log(`🗑️ Удаляем заказ #${orderId}...`);

        // Удаляем заказ из базы данных
        const { error } = await (window.supabase || supabase)
            .from('orders')
            .delete()
            .eq('id', orderId);

        if (error) {
            throw error;
        }

        // Показываем уведомление с информацией о пользователе и продукте
        if (typeof showNotification === 'function') {
            showNotification(`✅ Заказ${productInfo}${userInfo} успешно удален`, 'success');
        }
        
        // Добавляем сообщение об удалении в интерфейс заказов
        const contentArea = document.getElementById('admin-content-area');
        if (contentArea) {
            const deleteMessage = document.createElement('div');
            deleteMessage.style.cssText = 'background: rgba(244, 67, 54, 0.1); border: 1px solid rgba(244, 67, 54, 0.3); color: #f44336; padding: 10px; border-radius: 5px; margin-bottom: 10px; font-size: 0.9rem; font-weight: bold;';
            deleteMessage.innerHTML = `🗑️ Заказ${productInfo}${userInfo} был удален из системы`;
            deleteMessage.id = 'delete-message';
            
            // Удаляем предыдущее сообщение об удалении если есть
            const existingMessage = document.getElementById('delete-message');
            if (existingMessage) {
                existingMessage.remove();
            }
            
            // Находим контейнер с заказами и вставляем сообщение перед ним
            const ordersContainer = contentArea.querySelector('div[style*="max-height: 450px"]');
            if (ordersContainer) {
                // Вставляем сообщение прямо перед контейнером с заказами
                ordersContainer.parentNode.insertBefore(deleteMessage, ordersContainer);
            } else {
                // Если контейнер не найден, вставляем после заголовка
                const header = contentArea.querySelector('h4');
                if (header) {
                    header.parentNode.insertBefore(deleteMessage, header.nextSibling);
                } else {
                    contentArea.insertBefore(deleteMessage, contentArea.firstChild);
                }
            }
            
            // Автоматически скрываем сообщение через 5 секунд
            setTimeout(() => {
                if (deleteMessage.parentNode) {
                    deleteMessage.remove();
                }
            }, 5000);
        }
        
        // Обновляем список заказов
        if (typeof loadOrders === 'function') {
            await loadOrders();
        } else if (typeof shopManager !== 'undefined' && typeof shopManager.loadOrders === 'function') {
            await shopManager.loadOrders();
        }
        
        // Обновляем индикаторы в админ-панели
        if (typeof updateAdminNavIndicators === 'function') {
            updateAdminNavIndicators();
        }
        
    } catch (error) {
        console.error('❌ Ошибка при удалении заказа:', error);
        if (typeof showNotification === 'function') {
            showNotification(`❌ Ошибка удаления заказа: ${error.message}`, 'error');
        }
    }
};

/**
 * Мгновенно обновляет отображение модов при изменении VIP статуса пользователя
 * @param {string} userId - ID пользователя
 * @param {boolean} isVip - Новый VIP статус
 */
window.updateModsForVipChange = async function(userId, isVip) {
    // Защита от циклических вызовов
    const updateKey = `${userId}_${isVip}`;
    
    // Если блокировка активна и те же данные - пропускаем
    if (window.updateModsForVipChangeLock && window.lastVipUpdate === updateKey) {
        console.log('🔄 Пропускаем повторный вызов updateModsForVipChange - те же данные');
        return;
    }
    
    // Если блокировка активна но данные разные - ждем сброса
    if (window.updateModsForVipChangeLock) {
        console.log('🔄 Ожидаем сброса блокировки updateModsForVipChange');
        return;
    }
    
    // Устанавливаем блокировку
    window.updateModsForVipChangeLock = true;
    window.lastVipUpdate = updateKey;
    
    try {
        console.log(`🔄 Обновление модов для пользователя ${userId}, VIP статус: ${isVip}`);
        console.log('🔍 Проверяем наличие VIP контейнеров в DOM...');
        
        // Проверяем наличие VIP контейнеров до выполнения
        const initialVipContainers = document.querySelectorAll('.requires-vip');
        console.log('🔍 Нача��ьное количество VIP контейнеров:', initialVipContainers.length);
    
    // Если это текущий пользователь, обновляем его интерфейс
    if (window.authManager && window.authManager.getCurrentUser()?.id === userId) {
        console.log('🔄 Обновляем интерфейс текущего пользователя...');
        
        // Принудительно обновляем роль
        if (typeof getUserRole === 'function') {
            getUserRole(true);
        }
        
        // Обновляем UI
        if (window.authManager.updateUIForLoggedInUser) {
            window.authManager.updateUIForLoggedInUser();
        }
        
        // Обновляем VIP контент
        if (window.authManager.checkAndShowVipContent) {
            window.authManager.checkAndShowVipContent();
        }
        
        // Перезагружаем моды с новым VIP статусом
        if (typeof loadMods === 'function') {
            loadMods();
        }

        // 🔧 ИСПРАВЛЕНИЕ: Если VIP статус активирован, переключаемся на VIP игру и ПЕРЕЗАГРУЖАЕМ моды
        if (isVip && typeof switchGameVersion === 'function') {
            console.log('💎 Загружаем VIP моды после активации статуса');
            await switchGameVersion('vip_mods', 'Все');
            
            // 🔧 ВАЖНО: Перезагружаем моды для обновления кнопок скачивания
            console.log('🔄 Перезагружаем моды для обновления кнопок...');
            if (typeof loadModsByCategory === 'function') {
                await loadModsByCategory('Все', 'vip_mods');
            }
        } else if (!isVip) {
            // Если VIP неактивен, переключаемся на обычную категорию
            console.log('🔄 VIP неактивен, переключаемся на обычные моды');
            if (typeof switchGameVersion === 'function') {
                await switchGameVersion('fs25', 'Все');
            }
        }
        
        // Показываем или скрываем VIP контейнеры в зависимости от статуса
        let retryCount = 0;
        const maxRetries = 3;
        
        const showHideVipContainers = () => {
            const vipContainers = document.querySelectorAll('.requires-vip');
            console.log('🔍 Найдено VIP контейнеров:', vipContainers.length);
            
            if (vipContainers.length === 0 && isVip && retryCount < maxRetries) {
                retryCount++;
                console.log(`⚠️ VIP контейнеры не найдены, пробуем повторно через 500мс... (${retryCount}/${maxRetries})`);
                setTimeout(showHideVipContainers, 500);
                return;
            }
            
            if (vipContainers.length === 0 && isVip && retryCount >= maxRetries) {
                console.log(`❌ Не удалось найти VIP контейнеры после ${maxRetries} попыток. Проблема с DOM структурой.`);
                // Дополнительная отладка
                console.log('🔍 Дополнительная диагностика DOM:');
                console.log('- Существует ли document:', !!document);
                console.log('- Существует ли querySelectorAll:', !!document.querySelectorAll);
                console.log('- Пробуем найти по ID:', document.getElementById('vip_modsCategories'));
                console.log('- Все элементы с классом game-categories:', document.querySelectorAll('.game-categories').length);
                return;
            }
            
            vipContainers.forEach(container => {
                if (isVip) {
                    container.style.display = 'block';
                    console.log('✅ Показываем VIP контейнер:', container.id);
                } else {
                    container.style.display = 'none';
                    console.log('❌ Скрываем VIP контейнер:', container.id);
                }
            });
        };
        
        // Используем requestAnimationFrame для гарантии загрузки DOM
        if (isVip) {
            requestAnimationFrame(() => {
                setTimeout(showHideVipContainers, 200);
            });
        } else {
            setTimeout(showHideVipContainers, 200);
        }
        
        // Обновляем навигационные индикаторы
        if (typeof updateAdminNavIndicators === 'function') {
            updateAdminNavIndicators();
        }
    }
    
    // Отправляем событие для всех клиентов
    window.dispatchEvent(new CustomEvent('modsRefreshRequired', {
        detail: {
            userId: userId,
            isVip: isVip,
            reason: 'vip_status_changed',
            timestamp: new Date().toISOString()
        }
    }));
    
    // Сохраняем в localStorage для синхронизации между вкладками
    localStorage.setItem('mods_refresh_required', JSON.stringify({
        userId: userId,
        isVip: isVip,
        reason: 'vip_status_changed',
        timestamp: Date.now()
    }));
    
    // Сбрасываем блокировку через небольшую задержку
    setTimeout(() => {
        window.updateModsForVipChangeLock = false;
        console.log('🔓 Блокировка updateModsForVipChange сброшена');
    }, 300);
    
    } catch (error) {
        console.error('❌ Ошибка обновления модов:', error);
        
        // Сбрасываем блокировку при ошибке
        window.updateModsForVipChangeLock = false;
        console.log('🔓 Блокировка updateModsForVipChange сброшена из-за ошибки');
    }
};

// Функция для отображения всех предупреждений (компактная версия)
window.showAllWarnings = async function() {
    try {
        const contentArea = document.getElementById('admin-content-area');
        if (!contentArea) return;

        contentArea.innerHTML = `
            <div style="padding: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="color: #ff9800; margin: 0;">⚠️ Все предупреждения пользователей</h2>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <span id="warnings-counter" style="color: #fff; background: #ff9800; padding: 5px 10px; border-radius: 5px; font-weight: bold;">0</span>
                        <button onclick="window.showModsManagement()" style="background: #666; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer;">← Назад</button>
                    </div>
                </div>
                <div id="warnings-list" style="display: flex; flex-direction: column; gap: 10px; max-class=\ scrollable\">
                    <div style="text-align: center; color: #666; padding: 40px;">��агрузка предупреждений...</div>
                </div>
            </div>
        `;

        // Загружаем предупреждения
        await loadWarningsListCompact();

    } catch (error) {
        console.error('Ошибка при отображении предупреждений:', error);
        showNotification('❌ Не удалось загрузить предупреждения', 'error');
    }
};

// Компактная функция загрузки предупреждений
async function loadWarningsListCompact() {
    try {
        // Получаем предупреждения
        const { data: warnings, error } = await supabase
            .from('user_warnings')
            .select(`
                id,
                user_id,
                moderator_id,
                reason,
                comment_id,
                created_at
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const warningsList = document.getElementById('warnings-list');
        const counter = document.getElementById('warnings-counter');
        
        if (!warningsList || !counter) return;

        counter.textContent = warnings.length;

        if (warnings.length === 0) {
            warningsList.innerHTML = `
                <div style="text-align: center; color: #666; padding: 40px;">
                    <div style="font-size: 48px; margin-bottom: 20px;">✅</div>
                    <div>Нет активных предупреждений</div>
                </div>
            `;
            return;
        }

        // Получаем информацию о пользователях и модераторах отдельно
        const userIds = [...new Set(warnings.map(w => w.user_id))];
        const moderatorIds = [...new Set(warnings.map(w => w.moderator_id))];
        
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, username, email, role')
            .in('id', [...userIds, ...moderatorIds]);

        const profileMap = {};
        if (profiles) {
            profiles.forEach(profile => {
                profileMap[profile.id] = profile;
            });
        }

        warningsList.innerHTML = warnings.map(warning => {
            const date = new Date(warning.created_at);
            const formattedDate = date.toLocaleDateString('ru-RU');
            const formattedTime = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            
            const userProfile = profileMap[warning.user_id];
            const moderatorProfile = profileMap[warning.moderator_id];
            
            const roleIcons = {
                'owner': '👑',
                'admin_senior': '💎',
                'admin': '⚡',
                'moderator_senior': '🔥',
                'moderator': '🛡️'
            };
            const moderatorIcon = roleIcons[moderatorProfile?.role] || '👤';
            
            return `
                <div key="${warning.id}" style="background: rgba(255, 152, 0, 0.1); border: 1px solid rgba(255, 152, 0, 0.3); border-radius: 10px; padding: 15px; position: relative;">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div style="color: #ff9800; font-weight: bold;">${userProfile?.username || 'Пользователь'}</div>
                            <div style="color: #666; font-size: 12px;">📧 ${userProfile?.email || 'no@email.com'}</div>
                        </div>
                        <div style="display: flex; gap: 5px;">
                            <button onclick="deleteWarningCompact('${warning.id}')" style="background: #f44336; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;" title="Удалить предупреждение">🗑️</button>
                        </div>
                    </div>
                    
                    <div style="color: #fff; margin-bottom: 8px; font-size: 14px;">
                        📝 ${warning.reason}
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #666;">
                        <div>От ${moderatorIcon} ${moderatorProfile?.username || 'Модератор'}</div>
                        <div>${formattedDate} ${formattedTime}</div>
                    </div>
                    
                    ${warning.comment_id ? `
                        <div style="margin-top: 8px; font-size: 11px; color: #888;">
                            📄 Комментарий: ${warning.comment_id.substring(0, 8)}...
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Ошибка загрузки предупреждений:', error);
        document.getElementById('warnings-list').innerHTML = `
            <div style="text-align: center; color: #f44336; padding: 40px;">
                ❌ Ошибка загрузки предупреждений
            </div>
        `;
    }
}

// Функция для удаления предупреждения
async function deleteWarningCompact(warningId) {
    if (!confirm('⚠️ Удалить это предупреждение?')) return;

    try {
        // СНАЧАЛА получаем данные предупреждения ДО удаления
        let warningData = null;
        if (window.notificationTicker) {
            const { data: warning, error: warningError } = await supabase
                .from('user_warnings')
                .select('reason, user_id, moderator_id')
                .eq('id', warningId)
                .single();
            
            if (!warningError && warning) {
                warningData = warning;
            }
        }

        // ТЕПЕРЬ удаляем предупреждение
        const { error } = await supabase
            .from('user_warnings')
            .delete()
            .eq('id', warningId);

        if (error) throw error;

        // Отправляем уведомление в бегущую строку (используем сохраненные данные)
        if (window.notificationTicker && warningData) {
            const { data: userProfile, error: userProfileError } = await supabase
                .from('profiles')
                .select('username')
                .eq('id', warningData.user_id);
            if (userProfileError) throw userProfileError;

            const { data: moderatorProfile, error: moderatorProfileError } = await supabase
                .from('profiles')
                .select('username')
                .eq('id', warningData.moderator_id);
            if (moderatorProfileError) throw moderatorProfileError;

            window.notificationTicker.addWarningMessage(
                userProfile?.username || 'Пользователь',
                warningData.reason,
                moderatorProfile?.username || 'Модератор'
            );
        }

        showNotification('✅ Предупреждение успешно удалено', 'success');

        // Перезагружаем список
        await loadWarningsListCompact();

    } catch (error) {
        console.error('Ошибка удаления предупреждения:', error);
        showNotification('❌ Не удалось удалить предупреждение', 'error');
    }
}

// Функция для разблокировки пользователя
window.unbanUser = async function(banId, userId) {
    try {
        // Подтверждение действия
        if (!confirm('Вы уверены, что хотите разблокировать этого пользователя?')) {
            return;
        }
        
        // Деактивируем блокировку
        const { error } = await supabase
            .from('comment_bans')
            .update({ 
                is_active: false,
                updated_at: new Date().toISOString()
            })
            .eq('id', banId);
            
        if (error) throw error;
        
        // Показываем уведомление
        if (typeof showNotification === 'function') {
            showNotification('✅ Пользователь успешно разблокирован', 'success');
        }
        
        // Обновляем список блокировок
        await window.showAllBans();
        
        // Обновляем индикаторы
        if (typeof updateAdminNavIndicators === 'function') {
            await updateAdminNavIndicators();
        }
        
    } catch (error) {
        console.error('Ошибка разблокировки:', error);
        if (typeof showNotification === 'function') {
            showNotification('❌ Ошибка разблокировки: ' + error.message, 'error');
        }
    }
};

window.showAllBans = async function() {
    const contentArea = document.getElementById('admin-content-area');
    if (!contentArea) return;
    
    contentArea.innerHTML = `
        <div style="color: #f44336; padding: 20px;">
            <h4>🚫 Все блокировки комментариев</h4>
            <p>Загрузка данных...</p>
        </div>
    `;
    
    try {
        // Получаем блокировки (без связей с auth.users т.к. это вызывает ошибку)
        const { data: bans, error } = await supabase
            .from('comment_bans')
            .select('*')
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        
        const bansHtml = bans?.map(ban => {
            const isActive = ban.is_active && (!ban.ends_at || new Date(ban.ends_at) > new Date());
            const banTypeText = ban.ban_type === 'permanent' ? 'Постоянная блокировка комментариев' : 
                              ban.ban_type === 'account' ? 'Полная блокировка аккаунта' : 
                              `Временная блокировка комментариев (${ban.duration_days} дней)`;
            
            return `
            <div style="background: rgba(244,67,54,0.1); border: 1px solid rgba(244,67,54,0.3); border-radius: 8px; padding: 15px; margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <div>
                        <strong style="color: #f44336; font-size: 1.1rem;">👤 ID: ${ban.user_id?.substring(0, 8)}...</strong>
                        <div style="color: #888; font-size: 0.8rem; margin-top: 2px;">Пользователь</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="color: #f44336; font-size: 0.9rem;">${new Date(ban.created_at).toLocaleDateString()}</div>
                        <div style="color: #888; font-size: 0.8rem;">${new Date(ban.created_at).toLocaleTimeString()}</div>
                    </div>
                </div>
                
                <div style="color: #ccc; font-size: 1rem; margin-bottom: 8px;">
                    <strong>📝 Причина:</strong> ${ban.reason}
                </div>
                
                <div style="color: #888; font-size: 0.9rem; margin-bottom: 8px;">
                    <strong>👨‍💼 Модератор ID:</strong> ${ban.moderator_id?.substring(0, 8)}...
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 8px;">
                    <div style="color: #ff9800; font-size: 0.9rem;">
                        <strong>🔒 Тип:</strong> ${banTypeText}
                    </div>
                    <div style="color: #666; font-size: 0.8rem;">
                        <strong>🔢 Счетч��к:</strong> ${ban.ban_count || 1}
                    </div>
                </div>
                
                ${ban.ends_at ? `
                <div style="color: #ff5722; font-size: 0.8rem; margin-bottom: 8px;">
                    <strong>⏰ Окончание:</strong> ${new Date(ban.ends_at).toLocaleDateString()} ${new Date(ban.ends_at).toLocaleTimeString()}
                </div>
                ` : ''}
                
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
                    <div style="${isActive ? 'color: #f44336;' : 'color: #4CAF50;'} font-size: 0.9rem; font-weight: bold;">
                        ${isActive ? '🚫 Активна' : '✅ Истекла'}
                    </div>
                    ${isActive ? `
                    <button onclick="unbanUserFromComments('${ban.user_id}', 'Пользователь')" style="background: #4CAF50; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">
                        🔓 Разблокировать
                    </button>
                    ` : ''}
                </div>
            </div>
        `;
        }).join('') || '<p style="color: #888; text-align: center;">Блокировок нет</p>';
        
        contentArea.innerHTML = `
            <div style="color: #f44336; padding: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h4>🚫 Все блокировки комментариев (${bans?.length || 0})</h4>
                    <button onclick="window.showModsManagement()" style="background: #f44336; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer;">
                        ← Назад
                    </button>
                </div>
                <div style="max-height: calc(100vh - 200px); overflow-y: auto;">
                    ${bansHtml}
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error('Ошибка загрузки блокировок:', error);
        contentArea.innerHTML = `
            <div style="color: #f44336; padding: 20px;">
                <h4>🚫 Все блокировки комментариев</h4>
                <p style="color: #f44336;">❌ Ошибка загрузки данных: ${error.message}</p>
                <button onclick="window.showModsManagement()" style="background: #f44336; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; margin-top: 10px;">
                    ← Назад
                </button>
            </div>
        `;
    }
};

/**
 * Проверяет необходимость обновления модов
 */
window.checkModsRefreshRequired = function() {
    const refresh = localStorage.getItem('mods_refresh_required');
    if (refresh) {
        const data = JSON.parse(refresh);
        const now = Date.now();
        
        // Если обновление не старше 10 секунд, обрабатываем его
        if (now - data.timestamp < 10000) {
            console.log('🔄 Найдено требование обновления модов:', data);
            
            // Выполняем обновление модов
            if (typeof loadMods === 'function') {
                loadMods();
            }
            
            // Обновляем VIP контент
            if (window.authManager && window.authManager.checkAndShowVipContent) {
                window.authManager.checkAndShowVipContent();
            }
            
            // Удаляем обработанное требование
            localStorage.removeItem('mods_refresh_required');
        }
    }
};

// Проверяем требования обновления каждые 3 секунды
setInterval(window.checkModsRefreshRequired, 3000);

// Слушаем события обновления модов
window.addEventListener('modsRefreshRequired', function(event) {
    console.log('📡 Получено событие обновления модов:', event.detail);
    
    if (typeof loadMods === 'function') {
        loadMods();
    }
    
    if (window.authManager && window.authManager.checkAndShowVipContent) {
        window.authManager.checkAndShowVipContent();
    }
});

// Слушаем события изменения VIP статуса
window.addEventListener('vipStatusChanged', function(event) {
    console.log('📡 Получено событие изменения VIP статуса:', event.detail);
    
    const { userId, isVip } = event.detail;
    
    // Обновляем моды для затронутого пользователя
    window.updateModsForVipChange(userId, isVip);
});

console.log('✅ Мгновенная синхронизация модов активирована');

// Экспортируем функции для доступа из других скриптов
window.showAllWarnings = showAllWarnings;
window.showAllBans = showAllBans;

// Разблокировка пользователя из комментариев
window.unbanUserFromComments = async function(userId, username) {
    if (!userId) {
        alert('❌ ID пользователя не указан');
        return;
    }

    if (!confirm(`✅ Разблокировать пользователя "${username}"?\n\nПользователь снова сможет оставлять комментарии.`)) {
        return;
    }

    try {
        // Деактивируем блокировку комментариев
        const { error: commentError } = await window.supabase
            .from('comment_bans')
            .update({ 
                is_active: false,
                ends_at: new Date().toISOString()
            })
            .eq('user_id', userId)
            .eq('is_active', true);

        if (commentError) {
            console.error('❌ Ошибка разблокировки комментариев:', commentError);
            alert(`❌ Ошибка: ${commentError.message}`);
            return;
        }

        alert('✅ Пользователь разблокирован! Комментарии снова доступны.');
        
        // Обновляем данные
        await window.loadBansData();
        
        // Если мы в детальном просмотре, обновляем его
        if (document.querySelector('div[style*="color: #f44336"] h2')?.textContent?.includes('Заблокированные комментарии')) {
            await window.showDetailedCommentBans();
        }
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
        alert('❌ Произошла ошибка при разблокировке');
    }
};

// Полная разблокировка пользователя
window.unbanUserCompletely = async function(userId, username) {
    if (!userId) {
        alert('❌ ID пользователя не указан');
        return;
    }

    if (!confirm(`🔓 ПОЛНОСТЬЮ разблокировать пользователя "${username}"?\n\nПользователь снова сможет заходить на сайт и использо��ать все функции.`)) {
        return;
    }

    try {
        // Разблокируем пользователя в profiles
        const { error: profileError } = await window.supabase
            .from('profiles')
            .update({ 
                is_banned: false,
                ban_reason: null,
                banned_at: null
            })
            .eq('id', userId);

        if (profileError) {
            console.error('❌ Ошибка полной разблокировки:', profileError);
            alert(`❌ Ошибка: ${profileError.message}`);
            return;
        }

        // Также деактивируем все блокировки комментариев
        const { error: commentError } = await window.supabase
            .from('comment_bans')
            .update({ 
                is_active: false,
                ends_at: new Date().toISOString()
            })
            .eq('user_id', userId)
            .eq('is_active', true);

        if (commentError) {
            console.warn('⚠️ Ошибка деактивации блокировок комментариев:', commentError);
        }

        alert('✅ Пользователь полностью разблокирован! Доступ к сайту восстановлен.');
        
        // Обновляем данные
        await window.loadBansData();
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
        alert('❌ Произошла ошибка при разблокировке');
    }
};

// Полная блокировка пользователя с принудительным выходом
window.executeFullBanWithLogout = async function(userId, reason) {
    // ЗАЩИТА: Нельзя блокировать владельца сайта
    if (window.authManager?.currentUser?.id === userId && window.authManager?.currentUser?.role === 'owner') {
        alert('🛡️ ЗАПРЕЩЕНО: Владелец сайта не может заблокировать сам себя!');
        return false;
    }
    
    // ЗАЩИТА: Проверяем роль пользователя перед блокировкой
    try {
        const { data: userProfile, error: profileError } = await window.supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

        if (!profileError && userProfile?.role === 'owner') {
            alert('🛡️ ЗАПРЕЩЕНО: Нельзя блокировать владельца сайта!');
            return false;
        }
    } catch (error) {
        console.warn('⚠️ Не удалось проверить роль пользователя:', error);
    }

    try {
        // Блокируем пользователя в profiles
        const { error: profileError } = await window.supabase
            .from('profiles')
            .update({ 
                is_banned: true,
                ban_reason: reason,
                banned_at: new Date().toISOString()
            })
            .eq('id', userId);

        if (profileError) {
            console.error('❌ Ошибка полной блокировки:', profileError);
            return false;
        }

        // Принудительно выходим пользователя из системы если он онлайн
        try {
            // Обновляем сессию пользователя чтобы она стала недействительной
            await window.supabase.auth.signOut();
            
            // Дополнительная проверка - если текущий пользователь заблокирован, выходим его
            if (window.authManager?.currentUser?.id === userId) {
                // Очища��м локальные данные
                localStorage.removeItem('supabase.auth.token');
                localStorage.removeItem('currentUser');
                sessionStorage.clear();
                
                // Перезагружаем страницу с соо��щением
                document.body.innerHTML = `
                    <div style="
                        display: flex; 
                        justify-content: center; 
                        align-items: center; 
                        height: 100vh; 
                        background: linear-gradient(135deg, #1a1a2e, #16213e);
                        color: #f44336;
                        font-family: Arial, sans-serif;
                        text-align: center;
                    ">
                        <div>
                            <div style="font-size: 4rem; margin-bottom: 20px;">🚫</div>
                            <h1 style="font-size: 2rem; margin-bottom: 15px;">Доступ заблокирован</h1>
                            <p style="font-size: 1.2rem; margin-bottom: 10px;">Причина: ${reason}</p>
                            <p style="color: #ccc; margin-bottom: 20px;">Вы будете перенаправлены на главную страницу...</p>
                            <div style="color: #888; font-size: 0.9rem;">Перезагрузка через <span id="countdown">5</span> секунд</div>
                        </div>
                    </div>
                `;
                
                // Обратный отсчет и перез��грузка
                let countdown = 5;
                const countdownInterval = setInterval(() => {
                    countdown--;
                    const countdownEl = document.getElementById('countdown');
                    if (countdownEl) countdownEl.textContent = countdown;
                    
                    if (countdown <= 0) {
                        clearInterval(countdownInterval);
                        window.location.href = '/';
                    }
                }, 1000);
                
                return true;
            }
        } catch (logoutError) {
            console.warn('⚠️ Ошибка выхода пользователя:', logoutError);
        }

        return true;
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
        return false;
    }
};

// Показывает подробный список полностью заблокированных пользователей (использует функцию из script.js)
window.showDetailedBannedUsers = function() {
    // Проверяем существует ли функция в script.js
    if (typeof window.showBannedUsersList === 'function') {
        window.showBannedUsersList();
    } else {
        // Если функция не найдена, показываем сообщение
        const contentArea = document.getElementById('admin-content-area');
        if (contentArea) {
            contentArea.innerHTML = `
                <div style="color: #ff4444; padding: 1rem; background: rgba(255, 68, 68, 0.1); border-radius: 5px; text-align: center;">
                    ❌ Функция отображения заблокированных пользователей не найдена<br>
                    <small>Убедитесь что script.js загружен</small>
                </div>
            `;
        }
    }
};

// Проверка статуса блокировки текущего пользователя
window.checkUserBanStatus = async function() {
    if (!window.authManager?.currentUser?.id) return;
    
    try {
        const { data: profile, error } = await window.supabase
            .from('profiles')
            .select('is_banned, ban_reason')
            .eq('id', window.authManager.currentUser.id)
            .single();

        if (error) throw error;

        // Если пользователь заблокирован, немедленно выходим его
        if (profile?.is_banned) {
            console.warn('⚠️ Пользователь заблокирован, выполняем выход...');
            
            // Показываем сообщение о блокировке
            document.body.innerHTML = `
                <div style="
                    display: flex; 
                    justify-content: center; 
                    align-items: center; 
                    height: 100vh; 
                    background: linear-gradient(135deg, #1a1a2e, #16213e);
                    color: #f44336;
                    font-family: Arial, sans-serif;
                    text-align: center;
                ">
                    <div>
                        <div style="font-size: 4rem; margin-bottom: 20px;">🚫</div>
                        <h1 style="font-size: 2rem; margin-bottom: 15px;">Доступ заблокирован</h1>
                        <p style="font-size: 1.2rem; margin-bottom: 10px;">Причина: ${profile.ban_reason || 'Нарушение правил'}</p>
                        <p style="color: #ccc; margin-bottom: 20px;">Вы будете перенаправлены на главную страницу...</p>
                        <div style="color: #888; font-size: 0.9rem;">Перезагрузка через <span id="countdown">5</span> секунд</div>
                    </div>
                </div>
            `;
            
            // Очищаем все данные
            localStorage.clear();
            sessionStorage.clear();
            
            // Выходим из системы
            await window.supabase.auth.signOut();
            
            // Обратный отсчет и перезагрузка
            let countdown = 5;
            const countdownInterval = setInterval(() => {
                countdown--;
                const countdownEl = document.getElementById('countdown');
                if (countdownEl) countdownEl.textContent = countdown;
                
                if (countdown <= 0) {
                    clearInterval(countdownInterval);
                    window.location.href = '/';
                }
            }, 1000);
        }
    } catch (error) {
        console.error('❌ Ошибка проверки статуса блокировки:', error);
    }
};

// Запускаем периодическую проверку статуса блокировки
if (typeof window.authManager !== 'undefined') {
    // Проверяем каждые 30 секунд
    setInterval(window.checkUserBanStatus, 30000);
    
    // Также проверяем сразу при загрузке
    setTimeout(window.checkUserBanStatus, 2000);
}

// Показывает информационное меню о блокировке пользователя
window.showUserBanInfo = async function(userId) {
    const contentArea = document.getElementById('admin-content-area');
    if (!contentArea) return;

    try {
        // Ищем пользователя в заблокированных
        const { data: bannedUser, error: bannedError } = await window.supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .eq('is_banned', true)
            .single();

        if (bannedError || !bannedUser) {
            // Ищем в блокировках комментариев
            const { data: commentBan, error: commentError } = await window.supabase
                .from('comment_bans')
                .select(`
                    *,
                    profiles:user_id (
                        username,
                        email
                    )
                `)
                .eq('user_id', userId)
                .eq('is_active', true)
                .single();

            if (commentError || !commentBan) {
                contentArea.innerHTML = `
                    <div style="color: #ff4444; padding: 1rem; background: rgba(255, 68, 68, 0.1); border-radius: 5px;">
                        ❌ Пользователь не найден или не заблокирован
                    </div>
                `;
                return;
            }

            // Показываем информацию о блокировке комментариев
            const createdDate = new Date(commentBan.created_at).toLocaleString('ru-RU');
            const duration = commentBan.duration_days ? `${commentBan.duration_days} дней` : 'Навсегда';
            const endDate = commentBan.ends_at ? new Date(commentBan.ends_at).toLocaleDateString('ru-RU') : 'Никогда';

            contentArea.innerHTML = `
                <div style="color: #f44336; class=\ scrollable\">
                    <div style="display: flex; align-items: center; margin-bottom: 30px;">
                        <button onclick="window.showUserBans()" style="
                            background: rgba(244, 67, 54, 0.2);
                            color: #f44336;
                            border: 1px solid rgba(244, 67, 54, 0.3);
                            padding: 12px 20px;
                            border-radius: 10px;
                            cursor: pointer;
                            margin-right: 20px;
                            font-size: 1rem;
                            font-weight: bold;
                        ">
                            ← Назад к пользователям
                        </button>
                        <h2 style="margin: 0; font-size: 1.5rem;">🚫 Заблокированные комментарии</h2>
                    </div>

                    <div style="
                        background: linear-gradient(135deg, rgba(244, 67, 54, 0.1), rgba(255, 152, 0, 0.05));
                        border: 2px solid rgba(244, 67, 54, 0.3);
                        border-radius: 20px;
                        padding: 30px;
                        max-width: 800px;
                        margin: 0 auto;
                        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                    ">
                        <div style="text-align: center; margin-bottom: 30px;">
                            <div style="font-size: 4rem; margin-bottom: 15px;">🚫</div>
                            <div style="color: #ff9800; font-size: 1.3rem; font-weight: bold; margin-bottom: 10px;">${commentBan.profiles?.username || 'Пользователь'}</div>
                            <div style="color: #ccc; font-size: 1rem;">${commentBan.profiles?.email || 'Email не указан'}</div>
                        </div>

                        <div style="background: rgba(0,0,0,0.2); border-radius: 15px; padding: 20px; margin-bottom: 25px;">
                            <div style="color: #f44336; font-weight: bold; font-size: 1.1rem; margin-bottom: 15px; text-align: center;">📋 Информация о блокировке</div>
                            
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 8px;">
                                    <span style="color: #ccc;">📝 Причина:</span>
                                    <span style="color: #ff9800; font-weight: bold;">${commentBan.reason}</span>
                                </div>
                                
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 8px;">
                                    <span style="color: #ccc;">⏰ Длительность:</span>
                                    <span style="color: #ff9800; font-weight: bold;">${duration}</span>
                                </div>
                                
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 8px;">
                                    <span style="color: #ccc;">📅 Создана:</span>
                                    <span style="color: #ff9800; font-weight: bold;">${createdDate}</span>
                                </div>
                                
                                ${commentBan.ends_at ? `
                                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 8px;">
                                        <span style="color: #ccc;">🔓 Разблокировка:</span>
                                        <span style="color: #4CAF50; font-weight: bold;">${endDate}</span>
                                    </div>
                                ` : `
                                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 8px;">
                                        <span style="color: #ccc;">👮 Заблокировал:</span>
                                        <span style="color: #ff9800; font-weight: bold;">АДМИН</span>
                                    </div>
                                `}
                            </div>
                        </div>

                        <div style="text-align: center;">
                            <div style="color: #f44336; font-size: 1.2rem; font-weight: bold; margin-bottom: 20px;">🚫 ЗАБЛОКИРОВАН 👮 ZALUPA (АДМИН)</div>
                            
                            <button 
                                onclick="window.unbanUserFromComments('${userId}', '${commentBan.profiles?.username || 'Пол��зователь'}')" 
                                style="background: linear-gradient(135deg, #4CAF50, #45a049); color: white; border: none; padding: 15px 40px; border-radius: 12px; cursor: pointer; font-weight: bold; font-size: 1.1rem; transition: all 0.3s ease; box-shadow: 0 5px 15px rgba(76, 175, 80, 0.3);"
                                onmouseover="this.style.background='linear-gradient(135deg, #45a049, #3d8b40)'; this.style.transform='translateY(-2px)'" 
                                onmouseout="this.style.background='linear-gradient(135deg, #4CAF50, #45a049)'; this.style.transform='translateY(0)'"
                            >
                                🔓 Разблокировать
                            </button>
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        // Показываем информацию о полной блокировке
        const bannedDate = new Date(bannedUser.banned_at).toLocaleString('ru-RU');
        
        contentArea.innerHTML = `
            <div style="color: #ff9800; class=\ scrollable\">
                <div style="display: flex; align-items: center; margin-bottom: 30px;">
                    <button onclick="window.showUserBans()" style="
                        background: rgba(255, 152, 0, 0.2);
                        color: #ff9800;
                        border: 1px solid rgba(255, 152, 0, 0.3);
                        padding: 12px 20px;
                        border-radius: 10px;
                        cursor: pointer;
                        margin-right: 20px;
                        font-size: 1rem;
                        font-weight: bold;
                    ">
                        ← Назад к пользователям
                    </button>
                    <h2 style="margin: 0; font-size: 1.5rem;">🚫 Заблокированные пользователи (1)</h2>
                </div>

                <div style="
                    background: linear-gradient(135deg, rgba(255, 152, 0, 0.1), rgba(255, 193, 7, 0.05));
                    border: 2px solid rgba(255, 152, 0, 0.3);
                    border-radius: 20px;
                    padding: 30px;
                    max-width: 800px;
                    margin: 0 auto;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                ">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <div style="font-size: 4rem; margin-bottom: 15px;">🚫</div>
                        <div style="color: #ff9800; font-size: 1.3rem; font-weight: bold; margin-bottom: 10px;">${bannedUser.email}</div>
                        <div style="color: #ccc; font-size: 1.1rem;">${bannedUser.username}</div>
                    </div>

                    <div style="background: rgba(0,0,0,0.2); border-radius: 15px; padding: 20px; margin-bottom: 25px;">
                        <div style="color: #ff9800; font-weight: bold; font-size: 1.1rem; margin-bottom: 15px; text-align: center;">📋 Информация о блокировке</div>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 8px;">
                                <span style="color: #ccc;">📝 Причина:</span>
                                <span style="color: #ff9800; font-weight: bold;">${bannedUser.ban_reason || 'Не указана'}</span>
                            </div>
                            
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 8px;">
                                <span style="color: #ccc;">⏰ Длительность:</span>
                                <span style="color: #ff9800; font-weight: bold;">Навсегда</span>
                            </div>
                            
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 8px;">
                                <span style="color: #ccc;">📅 Дата бл��кировки:</span>
                                <span style="color: #ff9800; font-weight: bold;">${bannedDate}</span>
                            </div>
                            
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 8px;">
                                <span style="color: #ccc;">👮 Заблокировал:</span>
                                <span style="color: #ff9800; font-weight: bold;">АДМИН</span>
                            </div>
                        </div>
                    </div>

                    <div style="text-align: center;">
                        <div style="color: #f44336; font-size: 1.2rem; font-weight: bold; margin-bottom: 20px;">🚫 ЗАБЛОКИРОВАН 👮 ZALUPA (АДМИН)</div>
                        
                        <button 
                            onclick="window.unbanUserCompletely('${userId}', '${bannedUser.username}')" 
                            style="background: linear-gradient(135deg, #4CAF50, #45a049); color: white; border: none; padding: 15px 40px; border-radius: 12px; cursor: pointer; font-weight: bold; font-size: 1.1rem; transition: all 0.3s ease; box-shadow: 0 5px 15px rgba(76, 175, 80, 0.3);"
                            onmouseover="this.style.background='linear-gradient(135deg, #45a049, #3d8b40)'; this.style.transform='translateY(-2px)'" 
                            onmouseout="this.style.background='linear-gradient(135deg, #4CAF50, #45a049)'; this.style.transform='translateY(0)'"
                        >
                            🔓 Разблокировать
                        </button>
                    </div>
                </div>
            </div>
        `;

    } catch (error) {
        console.error('❌ Ошибка загрузки информации о блокировке:', error);
        contentArea.innerHTML = `
            <div style="color: #ff4444; padding: 1rem; background: rgba(255, 68, 68, 0.1); border-radius: 5px;">
                ❌ Ошибка: ${error.message}
            </div>
        `;
    }
};

// Экспорт новых функций для предупреждений
window.loadWarningsListCompact = loadWarningsListCompact;
window.deleteWarningCompact = deleteWarningCompact;
