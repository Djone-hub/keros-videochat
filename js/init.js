// ИНИЦИАЛИЗАЦИЯ И ЗАПУСК САЙТА KEROS MODS 2025

// Функция для динамической загрузки скриптов
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
        document.head.appendChild(script);
    });
}

// Простой клиентский роутер для обработки URL
async function handleRouting() {
    const path = window.location.pathname;
    // console.log(`🔄 Обработка маршрута: ${path}`);

    // Паттерн для /admin/users/UUID
    const userRouteMatch = path.match(/^\/admin\/users\/([0-9a-fA-F-]+)$/);

    if (userRouteMatch) {
        const userId = userRouteMatch[1];
        // console.log(`- Найден маршрут пользователя: ${userId}`);
        await showUserFromRoute(userId);
    }
}

// Показывает детали пользователя по ID из URL
async function showUserFromRoute(userId) {
    try {
        // 1. Проверяем, есть ли права администратора
        const profile = await getUserRole();
        const isAdmin = profile && (profile.isOwner || ['owner', 'admin_senior', 'admin', 'moderator_senior', 'moderator'].includes(profile.role));

        if (!isAdmin) {
            showNotification('❌ У вас нет прав для просмотра этой страницы.', 'error');
            return;
        }

        // 2. Открываем админ-панель
        showAdminPanelReliable();

        // 3. Загружаем данные конкретного пользователя
        showNotification('Загрузка данных пользователя...', 'info');
        const { data: user, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error || !user) {
            throw new Error(`Пользователь с ID ${userId} не найден.`);
        }

        // 4. Показываем модальное окно с деталями
        // Используем существующую функцию, передавая необходимые данные
        showUserDetailsModal(user.id, user.ip_address || 'Неизвестен', user.device_fingerprint || 'Неизвестен');

    } catch (error) {
        console.error('❌ Ошибка обработки маршрута пользователя:', error);
        showNotification(`❌ Ошибка: ${error.message}`, 'error');
    }
}

// Инициализация всех систем при загрузке страницы
document.addEventListener('DOMContentLoaded', async function() {
    // console.log('🚀 Запуск сайта KEROS MODS 2025...');

    // 🔑 ПРОВЕРКА: Убедимся что Supabase инициализирован
    let supabaseReady = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!supabaseReady && attempts < maxAttempts) {
        attempts++;
        // console.log(`🔄 Проверка инициализации Supabase (${attempts}/${maxAttempts})...`);

        if (window.supabase && typeof window.supabase.from === 'function') {
            supabaseReady = true;
            // console.log('✅ Supabase готов к работе');
            break;
        } else {
            // console.log(`⏳ Ожидание инициализации Supabase...`);
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }

    if (!supabaseReady) {
        console.error('❌ Supabase не инициализирован после нескольких попыток');
        showNotification('❌ Ошибка инициализации базы данных. Некоторые функции могут не работать.', 'error');
    }

    // 🎨 ВАЖНО: Инициализируем глобальную тему в первую очередь,
    // чтобы пользователи сразу видели правильный дизайн.
    if (typeof initializeGlobalTheme === 'function') {
        await initializeGlobalTheme();
    }

    // 💎 ВАЖНО: Инициализируем синхронизацию VIP статуса для мгновенных обновлений
    if (typeof initializeVipStatusSync === 'function') {
        await initializeVipStatusSync();
    }

    try {
        // Инициализируем все модули последовательно
        // console.log('📦 Загрузка модулей...');

        // Ждем инициализации Supabase
        // console.log('⏳ Ожидаем инициализации Supabase...');
        let supabaseAttempts = 0;
        const maxSupabaseAttempts = 50; // 5 секунд максимум
        while (!window.supabaseReady && supabaseAttempts < maxSupabaseAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            supabaseAttempts++;
        }
        if (!window.supabaseReady) {
            // console.log('❌ Supabase не инициализирован за отведенное время');
            return;
        }
        // console.log('✅ Supabase готов');

        // Ждем загрузки модулей
        await new Promise(resolve => setTimeout(resolve, 100));

        // Инициализируем хранилище
        if (typeof initializeStorage === 'function') {
            // console.log('💾 Инициализация хранилища...');
            initializeStorage();
        }

        // Инициализируем аутентификацию
        if (typeof initializeAuth === 'function') {
            // console.log('🔐 Инициализация аутентификации...');
            // СНАЧАЛА инициализируем систему, чтобы она была готова к работе
            await initializeAuth();

            // ТЕПЕРЬ, когда система готова, пытаемся восстановить сессию админа
            const savedAdminSession = sessionStorage.getItem('adminSession');
            if (savedAdminSession && !sessionStorage.getItem('isUserViewMode')) {
                try {
                    const session = JSON.parse(savedAdminSession);
                    await supabase.auth.setSession(session);
                    // console.log('👑 Сессия администратора восстановлена.');
                    sessionStorage.removeItem('adminSession');
                    window.location.reload(); // Перезагружаем страницу для полного применения сессии
                } catch (e) {
                    console.error('Ошибка восстановления сессии администратора:', e);
                }
            }
        }

        // Инициализируем остальные модули
        if (typeof initializeShop === 'function') {
            // console.log('🛒 Инициализация магазина...');
            // Ждем инициализации authManager
            if (typeof window.authManager !== 'undefined') {
                await initializeShop();
            } else {
                // console.log('⏳ Ожидаем инициализации authManager для магазина...');
                // Проверяем каждые 100ms, готов ли authManager
                let attempts = 0;
                const maxAttempts = 50; // 5 секунд максимум
                while (typeof window.authManager === 'undefined' && attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    attempts++;
                }
                if (typeof window.authManager !== 'undefined') {
                    // console.log('✅ authManager готов, инициализируем магазин');
                    await initializeShop();
                } else {
                    // console.error('❌ authManager не инициализирован за отведенное время');
                }
            }
        }

        // Инициализируем систему модов
        // console.log('🎮 Инициализация системы модов...');
        if (typeof initializeMods === 'function') {
            await initializeMods();
        } else if (window.modsManager) {
            await modsManager.initialize();
        } else {
            // Загружаем скрипт mods-system.js динамически если он не загружен
            await loadScript('js/mods-system.js');
            if (window.initializeMods) {
                await initializeMods();
            }
        }

        if (typeof initializeAdmin === 'function') {
            // console.log('⚙️ Инициализация админ панели...');
            initializeAdmin();
        }

        // Инициализация фоновой музыки
        if (typeof window.initializeBackgroundMusic === 'function') {
            // console.log('🎵 Инициализация фоновой музыки...');
            await window.initializeBackgroundMusic();
        }

        // console.log('✅ Все модули загружены успешно!');

        // Проверяем, не находимся ли мы в режиме имперсонализации
        if (sessionStorage.getItem('impersonatedUser')) {
            // showImpersonationBanner(); // Убираем верхний баннер
            // console.log('👁️‍🗨️ Активен режим имперсонализации. Верхний баннер скрыт.');
        }

        // console.log('🔍 Проверяем loadSiteSettings:', typeof loadSiteSettings);
        if (typeof loadSiteSettings === 'function') {
            // console.log('✅ Вызываем loadSiteSettings');
            loadSiteSettings();
        } else {
            // console.warn('⚠️ Функция loadSiteSettings не найдена');
        }

        // Пароли админ панели удалены - вход теперь по ролям

        // Запускаем обработку маршрута
        await handleRouting();

        // Загружаем последнюю выбранную игру и категории
        loadLastSelectedGame();

        // Проверяем и показываем админ панель если нужно (один раз)
        if (typeof ensureAdminButtonVisible === 'function') {
            setTimeout(ensureAdminButtonVisible, 1000); // ensureAdminButtonVisible теперь сама обрабатывает логику режима гостя
        } else {
            // console.log('⚠️ Функция ensureAdminButtonVisible не найдена');
        }

        // console.log('🎉 Сайт готов к работе!');

    } catch (error) {
        console.error('❌ Ошибка инициализации сайта:', error);
        alert('Произошла ошибка загрузки сайта. Проверьте консоль для подробностей.');
    }
});

// Временная заглушка для loadLastSelectedGame если функция не определена
if (typeof window.loadLastSelectedGame === 'undefined') {
    window.loadLastSelectedGame = function() {
        // console.log('🔧 [loadLastSelectedGame] Используем временную заглушку');
        const lastGame = localStorage.getItem('selectedGameVersion') || 'fs25';
        if (typeof window.currentGameVersion !== 'undefined') {
            window.currentGameVersion = lastGame;
        }
        // console.log('🔧 [loadLastSelectedGame] Установлена игра:', lastGame);
    };
}