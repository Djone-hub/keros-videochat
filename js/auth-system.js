// Модуль системы аутентификации
// Ранний глобальный шим: если где-то вызывают updateUIForGuest до загрузки модуля
try {
    if (typeof window !== 'undefined' && typeof window.updateUIForGuest !== 'function') {
        window.updateUIForGuest = function () {
            try {
                // Если уже авторизован, ничего не делаем
                if (window.authManager && typeof window.authManager.isAuthenticated === 'function' && window.authManager.isAuthenticated()) {
                    return;
                }
                if (window.authManager && typeof window.authManager.updateUIForLoggedOutUser === 'function') {
                    window.authManager.updateUIForLoggedOutUser();
                } else {
                    // Базовый визуальный откат на гостя, если authManager ещё не доступен.
                    // Эта логика теперь централизована в authManager.updateUIForLoggedOutUser.
                }
            } catch (e) {
                console.error('❌ Ошибка раннего шима updateUIForGuest:', e);
            }
        };
    }
} catch (_) {}
// Управление пользователями, сессиями и авторизацией

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.sessionTimeout = 24 * 60 * 60 * 1000; // 24 часа
        this.adminSessionTimeout = 72 * 60 * 60 * 1000; // 72 часа для админов
        this.isInitialized = false;
        this.vipCountdownInterval = null; // Интервал для обратного отсчета VIP
        this.deviceFingerprint = null;
        this.profileChangesChannel = null; // Канал для отслеживания изменений профиля
    }
    

    // Очистка поврежденных токенов аутентификации
    clearInvalidTokens() {
        console.log('🗑️ Очищаем поврежденные токены аутентификации...');
        this.clearAllAuthData();
    }

    // Инициализация системы аутентификации
    async initialize() {
        if (this.isInitialized) return;

        try {
            // Создаем отпечаток устройства
            this.deviceFingerprint = await this.generateDeviceFingerprint();

            // Проверяем существующую сессию
            await this.checkExistingSession();

            // Настраиваем обработчики событий
            this.setupEventListeners();

            // Загружаем настройки из хранилища
            this.loadSettings();

            this.isInitialized = true;
            // console.log('✅ Система аутентификации инициализирована');
        } catch (error) {
            console.error('❌ Ошибка инициализации аутентификации:', error);
            throw error;
        }
    }

    // Генерация отпечатка устройства
    async generateDeviceFingerprint() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('Canvas fingerprint test', 2, 2);
        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
        ctx.fillRect(100, 5, 80, 20);

        const canvasFingerprint = canvas.toDataURL();

        const fingerprint = {
            userAgent: navigator.userAgent,
            language: navigator.language,
            platform: navigator.platform,
            cookieEnabled: navigator.cookieEnabled,
            screenWidth: screen.width,
            screenHeight: screen.height,
            colorDepth: screen.colorDepth,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            canvas: canvasFingerprint,
            timestamp: Date.now()
        };

        return btoa(JSON.stringify(fingerprint));
    }

    // Проверка существующей сессии
    async checkExistingSession() {
        const sessionData = storageManager.getLocalStorage('userSession');
        const impersonatedUserStr = sessionStorage.getItem('impersonatedUser');
        const adminSessionData = storageManager.getSessionStorage('adminSession');

        if (impersonatedUserStr) {
            // РЕЖИМ ИМПЕРСОНАЛИЗАЦИИ
            console.log('👁️‍🗨️ Обнаружен режим имперсонализации. Устанавливаем контекст...');
            const impersonatedProfile = JSON.parse(impersonatedUserStr);
            // Временно устанавливаем имперсонируемого пользователя как текущего
            this.currentUser = {
                id: impersonatedProfile.id,
                email: impersonatedProfile.email,
                user_metadata: { username: impersonatedProfile.username }
            };
            this.restoreUserState(true); // Восстанавливаем состояние для имперсонируемого пользователя
        } else if (sessionData && this.isSessionValid(sessionData) && sessionData.user) {
            // ОБЫЧНЫЙ РЕЖИМ
            // ИСПРАВЛЕНИЕ: Добавлена проверка sessionData.user, чтобы избежать ошибки, если объект пользователя в сессии равен null.
            // console.log('🔍 Найдена существующая сессия пользователя:', sessionData.user.email); 
            this.currentUser = sessionData.user;
            await this.ensureUserProfile(); // Проверяем и создаем профиль, если нужно
            this.restoreUserState(false);
            // ИСПРАВЛЕНИЕ: Применяем тему ПОСЛЕ восстановления сессии пользователя
            if (typeof applyThemeSettingsOnLoad === 'function') {
                applyThemeSettingsOnLoad();
            }
        } else {
            console.log('❌ Существующая сессия не найдена или недействительна');
            this.updateUIForLoggedOutUser(); // Показываем кнопки для гостя
            // ИСПРАВЛЕНИЕ: Применяем тему для гостя
            if (typeof applyThemeSettingsOnLoad === 'function') {
                applyThemeSettingsOnLoad();
            }
        }

        if (adminSessionData && this.isAdminSessionValid(adminSessionData)) {
            this.currentAdminSession = adminSessionData;
        }
    }

    // Проверка валидности сессии
    isSessionValid(sessionData) {
        if (!sessionData || !sessionData.loginTime) return false;

        const now = Date.now();
        const sessionAge = now - sessionData.loginTime;

        return sessionAge < this.sessionTimeout;
    }

    // Проверка валидности админ сессии
    isAdminSessionValid(sessionData) {
        if (!sessionData || !sessionData.loginTime) return false;

        const now = Date.now();
        const sessionAge = now - sessionData.loginTime;

        return sessionAge < this.adminSessionTimeout;
    }

    // Проверка корректности email адреса
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // РЕФАКТОРИНГ: Выносим проверку лимита по IP в отдельную функцию для чистоты кода.
    async checkIpLimit(ipAddress, username) {
        const ownerUsernamesForCheck = ['keros', 'djone', 'admin'];
        const ownerEmailsForCheck = ['ldjone@mail.ru']; // Email владельцев для проверок
        // ИСПРАВЛЕНИЕ: Проверяем, начинается ли IP с '::1', чтобы корректно обрабатывать '::1/128' и другие локальные IPv6 адреса.
        // Это предотвращает ложные срабатывания защиты при локальном тестировании.
        if (ownerUsernamesForCheck.includes(username.toLowerCase()) || ownerEmailsForCheck.some(email => username.toLowerCase().includes(email.split('@')[0])) || !ipAddress || 
            (ipAddress && (ipAddress.startsWith('::1') || ipAddress === '::1')) || 
            ipAddress === '127.0.0.1') {
            console.log('ℹ️ Проверка лимита по IP пропущена для владельца или локального адреса.');
            return; // Пропускаем проверку для владельцев и локальных адресов
        }

        const { data: existingProfiles, error: ipCountError } = await window.supabase
            .from('profiles')
            .select('id, username, created_at')
            .eq('ip_address', ipAddress);

        if (ipCountError) throw ipCountError;

        // ВОССТАНОВЛЕНИЕ: Возвращаем строгую проверку по IP.
        // Теперь система будет блокировать регистрацию, если с одного IP уже есть активный аккаунт.
        // ИЗМЕНЕНИЕ: Отключаем блокировку по IP и заменяем на предупреждение в консоли.
        // Это окончательно решает проблему с NAT у провайдеров, не мешая честным пользователям.
        // Строгая проверка по отпечатку устройства остается.
        if (existingProfiles && existingProfiles.length >= 1) {
            console.warn(
                `⚠️ Обнаружено совпадение по IP-адресу (${ipAddress}) для нового пользователя "${username}".`,
                `Существующие профили с этим IP:`, existingProfiles.map(p => p.username).join(', ')
            );
            // Блокировка отключена: throw new Error('Превышен лимит регистраций с этого IP-адреса.');
        }
    }

    // РЕФАКТОРИНГ: Выносим проверку лимита по отпечатку устройства в отдельную функцию.
    async checkDeviceLimit(username) {
        const ownerUsernamesForCheck = ['keros', 'djone', 'admin'];
        const ownerEmailsForCheck = ['ldjone@mail.ru']; // Email владельцев для проверок
        if (ownerUsernamesForCheck.includes(username.toLowerCase()) || ownerEmailsForCheck.some(email => username.toLowerCase().includes(email.split('@')[0]))) {
            console.log('ℹ️ Проверка лимита по устройству пропущена для владельца.');
            return; // Пропускаем проверку для владельцев
        }

        const deviceFingerprint = await this.generateDeviceFingerprint();
        const { data: existingDevice, error: deviceError } = await window.supabase
            .from('profiles')
            .select('id, username, created_at')
            .eq('device_fingerprint', deviceFingerprint);

        if (deviceError) throw deviceError;
        
        // Если найдены существующие профили с этим отпечатком
        if (existingDevice && existingDevice.length > 0) {
            let activeProfilesCount = 0;
            // Проверяем каждый найденный профиль на активность в Supabase Auth
            for (const profile of existingDevice) {
                try {
                    const { data: authUser, error: authError } = await window.supabase.auth.admin.getUserById(profile.id);
                    // Если пользователь существует в Auth и нет ошибки, считаем его активным
                    if (!authError && authUser.user) {
                        activeProfilesCount++;
                    }
                } catch (authCheckError) {
                    // ИЗМЕНЕНИЕ: Если не удалось проверить (например, из-за прав), считаем профиль активным для безопасности, чтобы не разрешить регистрацию по ошибке.
                    console.warn(`Не удалось проверить активность профиля ${profile.username} в Auth. Считаем его активным для безопасности.`);
                    activeProfilesCount++;
                }
            }

            // Если есть хотя бы один активный профиль, блокируем регистрацию
            if (activeProfilesCount >= 1) {
                throw new Error('С этого устройства уже зарегистрирован активный аккаунт. Создание нескольких аккаунтов запрещено.');
            }
        }
    }

    // Регистрация нового пользователя
    async registerUser(email, password, username) {
        try {
            const originalUsername = username;

            if (typeof window.supabase === 'undefined') {
                throw new Error('Supabase клиент не инициализирован');
            }

            // 1. Проверка, не занят ли username (без учета регистра)
            const { data: existingUser, error: usernameError } = await window.supabase.from('profiles').select('id').ilike('username', originalUsername).maybeSingle();
            if (usernameError && usernameError.code !== 'PGRST116') {
                throw usernameError;
            }
            if (existingUser) {
                throw new Error('Это имя пользователя уже занято. Пожалуйста, выберите другое.');
            }

            // 2. Проверка лимита регистраций по IP
            const { data: ipData, error: ipError } = await window.supabase.rpc('get_ip_address');
            if (ipError) console.warn('⚠️ Не удалось получить IP адрес для проверки:', ipError.message);
            await this.checkIpLimit(ipData, originalUsername);

            // 3. Проверка лимита регистраций по отпечатку устройства
            await this.checkDeviceLimit(originalUsername);

            // 4. Регистрация пользователя в Supabase Auth
            const { data, error } = await window.supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        username: originalUsername
                    }
                }
            });

            if (error) throw error;

            return {
                success: true,
                user: data.user,
                needsConfirmation: !data.session
            };
        } catch (error) {
            console.error('Ошибка регистрации:', error);
            if (typeof showNotification === 'function') {
                let message;
                if (error.message.includes('User already registered')) {
                    message = 'Пользователь с таким email уже зарегистрирован.';
                } else if (error.message.includes('Password should not be a pwned password')) {
                    message = 'Этот пароль был скомпрометирован. Используйте другой, более надежный пароль.';
                } else if (error.message.includes('Превышен лимит') || error.message.includes('уже зарегистрирован активный аккаунт')) {
                    // ИСПРАВЛЕНИЕ: Заменяем детальные сообщения об ошибках на общее.
                    // Это скрывает от пользователя внутреннюю логику проверки по IP и отпечатку устройства.
                    // В консоли по-прежнему будет видна полная ошибка для отладки.
                    message = 'Не удалось создать аккаунт. Пожалуйста, проверьте введенные данные или попробуйте позже.';
                } else {
                    message = error?.message || 'Не удалось создать аккаунт';
                }
                try { showNotification('❌ Ошибка регистрации: ' + message, 'error'); } catch (_) {}
            }
            throw error;
        }
    }

    // Вход пользователя (поддержка email и username)
    async loginUser(login, password) {
        try {
            // Проверяем доступность window.supabase
            if (typeof window.supabase === 'undefined') {
                throw new Error('Supabase клиент не инициализирован');
            }

            console.log('🔐 Попытка входа с данными:', login);

            let email = login;
            let isUsernameLogin = false;

            // Проверяем, является ли введенное значение username или email
            if (!this.isValidEmail(login)) {
                console.log('📝 Введен username, ищем соответствующий email в profiles');
                isUsernameLogin = true;

                // Это username, нужно найти соответствующий email
                const { data: profile, error: profileError } = await window.supabase
                    .from('profiles')
                    .select('email')
                    .ilike('username', login) // Используем ilike для регистронезависимого поиска
                    .maybeSingle();

                if (profileError) {
                    console.error('❌ Ошибка поиска профиля по username:', profileError);
                    throw new Error(`Пользователь с именем "${login}" не найден`);
                }

                if (!profile) {
                    console.error('❌ Профиль не найден для username:', login);
                    // ИСПРАВЛЕНИЕ: Если профиль по имени не найден, не выбрасываем ошибку сразу.
                    // Пробуем использовать введенные данные как email.
                    // Это решает проблему, когда пользователь существует в auth, но профиль еще не создан.
                    console.log('🤔 Профиль по имени не найден. Пробуем войти, используя введенные данные как email...');
                    email = login; // Предполагаем, что это может быть email.
                } else {
                    email = profile.email;
                    console.log('✅ Найден email по username:', email);
                }
            } else {
                console.log('📧 Введен email напрямую:', email);
            }

            console.log('🔑 Пытаемся аутентифицировать в Supabase Auth с email:', email);

            const { data, error } = await window.supabase.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) {
                console.error('❌ Ошибка аутентификации Supabase:', error);

                // Очищаем поврежденные токены при ошибке аутентификации
                if (error.message.includes('Invalid login credentials') ||
                    error.message.includes('Invalid Refresh Token')) {
                    console.log('🗑️ Очищаем поврежденные токены аутентификации...');
                    localStorage.removeItem('sb-' + window.supabase.window.supabaseKey + '-auth-token');
                    localStorage.removeItem('window.supabase.auth.token');
                    sessionStorage.clear();
                }

                // Пробуем альтернативный подход для диагностики
                if (error.message.includes('Invalid login credentials')) {
                    console.log('🔍 Диагностика: проверяем существует ли пользователь в auth.users');

                    // Проверяем, существует ли пользователь в Supabase Auth
                    try {
                        const { data: users, error: usersError } = await window.supabase.auth.admin.listUsers();
                        if (!usersError && users.users) {
                            const userExists = users.users.some(u => u.email === email);
                            console.log('📊 Диагностика - пользователь существует в auth.users:', userExists);
                        }
                    } catch (diagError) {
                        console.log('ℹ️ Диагностика недоступна (требуются права админа)');
                    }
                }

                throw error;
            }

            console.log('✅ Аутентификация успешна, пользователь:', data.user.email);

            this.currentUser = data.user;
            console.log('🔄 Текущий пользователь установлен:', this.currentUser.email);

            await this.ensureUserProfile(); // Проверяем и создаем профиль

            // ✅ ИСПРАВЛЕНИЕ: Обновляем отпечаток устройства и IP при каждом входе.
            // Это решает проблему входа с разных устройств.
            try {
                const { data: ipData } = await window.supabase.rpc('get_ip_address');
                const { error: updateError } = await window.supabase
                    .from('profiles')
                    .update({
                        device_fingerprint: await this.generateDeviceFingerprint(),
                        ip_address: ipData
                    })
                    .eq('id', this.currentUser.id);
                if (updateError) throw updateError;
                console.log('✅ Отпечаток устройства и IP обновлены для пользователя:', this.currentUser.email);
            } catch (e) { console.warn('⚠️ Не удалось обновить отпечаток устройства:', e.message); }

            this.saveUserSession();
            this.restoreUserState();

            console.log('🔄 Сессия сохранена, состояние восстановлено');

            // 🔄 АВТОМАТИЧЕСКАЯ ПЕРЕЗАГРУЗКА СТРАНИЦЫ ПОСЛЕ ВХОДА
            // Это предотвращает дублирование бейджей и гарантирует чистое состояние
            console.log('🔄 Автоматическая перезагрузка страницы через 1 секунду...');
            setTimeout(() => {
                window.location.reload();
            }, 1000);

            return {
                success: true,
                user: data.user
            };
        } catch (error) {
            console.error('❌ Критическая ошибка входа:', error);

            // Показываем уведомление пользователю
            if (typeof showNotification === 'function') {
                let userMessage = error.message || 'Неизвестная ошибка';
                
                // Переводим технические ошибки на русский
                if (userMessage.includes('Cannot read properties of undefined (reading \'supabaseKey\')')) {
                    userMessage = 'Пользователь не зарегистрирован';
                } else if (userMessage.includes('Invalid login credentials')) {
                    userMessage = 'Неверный логин/email или пароль';
                } else if (userMessage.includes('Email not confirmed')) {
                    userMessage = 'Email не подтвержден';
                } else if (userMessage.includes('User not found')) {
                    userMessage = 'Пользователь не найден';
                }
                
                showNotification('❌ Ошибка входа: ' + userMessage, 'error');
            }

            throw error;
        }
    }

    // Выход пользователя
    async logoutUser() {
        try {
            // Проверяем доступность window.supabase
            if (typeof window.supabase === 'undefined') {
                throw new Error('Supabase клиент не инициализирован');
            }

            console.log('🚪 Начинаем процесс выхода пользователя...');

            await window.supabase.auth.signOut();
            console.log('✅ Supabase Auth разлогинирован');

            this.currentUser = null;
            this.clearUserSession();

            // Отписываемся от канала изменений профиля при выходе
            if (this.profileChangesChannel) {
                window.supabase.removeChannel(this.profileChangesChannel);
                this.profileChangesChannel = null;
                console.log('✅ Отписались от канала изменений профиля');
            }

            // 🔄 АВТОМАТИЧЕСКАЯ ПЕРЕЗАГРУЗКА СТРАНИЦЫ ПОСЛЕ ВЫХОДА
            // Это гарантирует чистое состояние UI и удаляет все данные сессии
            console.log('🔄 Автоматическая перезагрузка страницы после выхода через 1 секунду...');
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } catch (error) {
            console.error('Ошибка выхода:', error);
            throw error;
        }
    }

    // Тщательная очистка всех данных аутентификации
    clearAllAuthData() {
        try {
            console.log('🗑️ Полная очистка данных аутентификации...');

            // Очищаем локальное хранилище
            localStorage.removeItem('sb-' + (window.supabase?.supabaseKey || 'access_token') + '-auth-token');
            localStorage.removeItem('supabase.auth.token');
            localStorage.removeItem('userSession');
            localStorage.removeItem('authSettings');
            localStorage.removeItem('sb-' + (window.supabase?.supabaseKey || 'access_token') + '-auth-token.0');
            localStorage.removeItem('sb-' + (window.supabase?.supabaseKey || 'access_token') + '-auth-token.1');

            // Очищаем sessionStorage
            sessionStorage.clear();

            // Очищаем cookies если есть
            try {
                document.cookie.split(";").forEach(cookie => {
                    const eqPos = cookie.indexOf("=");
                    const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
                    if (name.includes('supabase') || name.includes('auth')) {
                        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
                        console.log('🗑️ Очищен cookie:', name);
                    }
                });
            } catch (cookieError) {
                console.log('ℹ️ Не удалось очистить cookies:', cookieError.message);
            }

            console.log('✅ Полная очистка данных аутентификации завершена');
        } catch (error) {
            console.error('❌ Ошибка очистки данных аутентификации:', error);
        }
    }

    // Сохранение сессии пользователя
    saveUserSession() {
        const sessionData = {
            user: this.currentUser,
            loginTime: Date.now(),
            deviceFingerprint: this.deviceFingerprint
        };

        storageManager.setLocalStorage('userSession', sessionData);
    }

    // Очистка сессии пользователя
    clearUserSession() {
        storageManager.setLocalStorage('userSession', null);
    }

    // Восстановление состояния пользователя
    restoreUserState(isImpersonating = false) {
        if (!this.currentUser) return;

        // Обновляем UI элементы
        this.updateUIForLoggedInUser();

        // Если это не режим имперсонализации, выполняем остальные действия
        if (!isImpersonating) {
            // Загружаем настройки пользователя
            this.loadUserPreferences();

            // Проверяем блокировку аккаунта
            this.checkAccountStatus();

            // Подписываемся на изменения профиля в реальном времени
            this.subscribeToProfileChanges();
        }
    }

    // Очистка состояния пользователя
    clearUserState() {
        // Сбрасываем UI элементы
        this.updateUIForLoggedOutUser();

        // Очищаем пользовательские данные
        this.clearUserPreferences();
    }

    // Создание профиля пользователя
    async createUserProfile(user, username, email, deviceFingerprint, ipAddress = null) {
        try {
            console.log('📝 Создаем профиль для пользователя:', username, email);

            // Определяем роль пользователя
            let userRole = 'user'; // По умолчанию обычный пользователь
            let isOwner = false;

            // Проверяем, является ли пользователь владельцем сайта (по email и username)
            const ownerEmails = ['ldjone@mail.ru']; // Email владельцев - ОСНОВНАЯ ПРОВЕРКА
            const ownerUsernames = ['KEROS', 'Djone']; // Дополнительная проверка по нику
            const adminUsernames = ['admin']; // Отдельный список для администраторов

            // Проверяем роль при создании профиля - СНАЧАЛА ПО EMAIL, ПОТОМ ПО USERNAME
            if (ownerEmails.map(e => e.toLowerCase()).includes(email.toLowerCase()) || 
                ownerUsernames.map(u => u.toLowerCase()).includes(username.toLowerCase())) {
                userRole = 'owner';
                console.log('👑 Создан профиль владельца сайта:', username, 'Email:', email);
            } else if (adminUsernames.map(u => u.toLowerCase()).includes(username.toLowerCase())) {
                userRole = 'admin'; // Назначаем роль 'admin'
                console.log('⚡ Создан профиль администратора:', username);
            } else {
                userRole = 'user';
                console.log('👤 Создан профиль обычного пользователя:', username);
            }

            console.log('🔧 Отправляем запрос на создание профиля с ролью:', userRole);

            // ИЗМЕНЕНО: Используем upsert для атомарного создания или обновления профиля. Это решает ошибки 409 Conflict.
            const { error } = await window.supabase
                .from('profiles')
                .upsert({
                    id: user.id,
                    username: username,
                    email: email,
                    role: userRole,
                    is_vip: false,
                    is_owner: (userRole === 'owner'), // is_owner будет true только если роль 'owner'
                    is_banned: false,
                    created_at: new Date().toISOString(),
                    device_fingerprint: deviceFingerprint,
                    ip_address: ipAddress
                }, { onConflict: 'id' }); // Указываем, что конфликт нужно разрешать по полю id

            if (error) {
                console.error('❌ Ошибка создания профиля:', error);
                throw error;
            } else {
                console.log('✅ Профиль пользователя создан с ролью:', userRole);
            }
        } catch (error) {
            console.error('❌ Критическая ошибка создания профиля:', error);
        }
    }

    // Проверка и создание профиля пользователя если его нет
    async ensureUserProfile() {
        if (!this.currentUser) {
            console.warn('⚠️ Попытка проверить профиль без текущего пользователя.');
            return;
        }

        try {
            console.log('🔍 Проверяем профиль пользователя:', this.currentUser.email);

            const { data: profile, error } = await window.supabase
                .from('profiles')
                .select('*')
                .eq('id', this.currentUser.id)
                .maybeSingle(); // ИЗМЕНЕНИЕ: Используем maybeSingle() для избежания ошибки 406

            // Если профиль не найден (результат null) или произошла ошибка, создаем его
            if (error && error.code !== 'PGRST116') { // Игнорируем только ошибку "0 rows" если она все же возникнет
                console.error('❌ Ошибка при получении профиля:', error.message);
                throw error;
            } else if (!profile) { // Если profile === null, значит запись не найдена
                console.log('📝 Профиль не найден в ensureUserProfile. Создаем новый...');
                const username = this.currentUser.user_metadata?.username || this.currentUser.email.split('@')[0];
                if (!this.currentUser.email) throw new Error("Email пользователя не определен, невозможно создать профиль.");

                // Получаем IP адрес через RPC вызов
                const { data: ipData, error: ipError } = await window.supabase.rpc('get_ip_address');
                if (ipError) console.warn('⚠️ Не удалось получить IP адрес при создании профиля:', ipError.message);

                await this.createUserProfile(this.currentUser, username, this.currentUser.email, await this.generateDeviceFingerprint(), ipData);
            } else {
                // Проверяем, нужно ли обновить ник в профиле
                const currentUsername = this.currentUser.user_metadata?.username;
                if (currentUsername && profile.username !== currentUsername) {
                    console.log('🔄 Обновляем ник в профиле:', profile.username, '->', currentUsername);
                    const { error: updateError } = await window.supabase
                        .from('profiles')
                        .update({ username: currentUsername })
                        .eq('id', this.currentUser.id);
                    
                    if (updateError) {
                        console.warn('⚠️ Не удалось обновить ник в профиле:', updateError.message);
                    } else {
                        console.log('✅ Ник в профиле успешно обновлен на:', currentUsername);
                    }
                }
                
                console.log('✅ Профиль найден в ensureUserProfile:', profile.username, 'Роль:', profile.role);
                // Если профиль найден, ничего не делаем, чтобы не перезаписать роль.
                return;
            }
        } catch (error) {
            console.error('❌ Критическая ошибка проверки профиля:', error);
            // Показываем уведомление пользователю
            if (typeof showNotification === 'function') {
                showNotification('Критическая ошибка профиля. Попробуйте перезагрузить страницу.', 'error');
            }
        }
    }

    // Обновление UI для авторизованного пользователя
    async updateUIForLoggedInUser() {
        console.log('🔄 Обновляем UI для авторизованного пользователя:', this.currentUser?.email);
        const authContainer = document.getElementById('auth-container');
        const userInfoTemplate = document.getElementById('user-info-template');

        if (authContainer && userInfoTemplate) {
            // Если блок пользователя еще не вставлен, вставляем его
            if (!authContainer.querySelector('#user-info-content')) {
                authContainer.innerHTML = userInfoTemplate.innerHTML;
            }

            const impersonatedUserStr = sessionStorage.getItem('impersonatedUser');
            const isUserViewMode = sessionStorage.getItem('isUserViewMode') === 'true';
            const usernameDisplay = authContainer.querySelector('#user-identifier');

            try {
                if (impersonatedUserStr) {
                    const profile = await this.getUserRole();
                    const username = this.currentUser.user_metadata?.username || this.currentUser.email;
                    const roleIcon = this.getRoleIcon(profile?.role, profile?.isOwner, false);
                    if (usernameDisplay) {
                        usernameDisplay.innerHTML = `<span class="role-icon">${roleIcon}</span> <span>${username}</span>`;
                    }
                    console.log(`👤 Отображаемое имя (имперсонация): ${username}, Роль: ${profile?.role || 'user'}`);
                } else {
                    // Обработка обычного пользователя (без имперсонации)
                    const profile = await this.getUserRole();
                    const username = this.currentUser.user_metadata?.username || this.currentUser.email || 'Пользователь';
                    const roleIcon = this.getRoleIcon(profile?.role, profile?.isOwner, false);
                    if (usernameDisplay) {
                        // Используем нашу функцию для отображения со временем VIP
                        if (typeof updateUserDisplayWithStatus === 'function') {
                            // Добавляем ID пользователя в профиль для таймера VIP
                            const profileWithId = {
                                ...profile,
                                id: this.currentUser.id
                            };
                            updateUserDisplayWithStatus(username, profileWithId);
                        } else {
                            usernameDisplay.innerHTML = `<span class="role-icon">${roleIcon}</span> <span>${username}</span>`;
                        }
                    }
                    console.log(`👤 Отображаемое имя (обычный пользователь): ${username}, Роль: ${profile?.role || 'user'}`);
                }
            } catch (error) {
                console.error('ℹ️ Ошибка при получении профиля для обновления UI:', error.message);
                // В случае ошибки показываем просто имя
                if (usernameDisplay && this.currentUser) {
                    usernameDisplay.textContent = this.currentUser.user_metadata?.username || this.currentUser.email;
                }
            }

            // Показываем блок пользователя и скрываем блок гостя
            const userInfoContent = authContainer.querySelector('#user-info-content');
            if (userInfoContent) userInfoContent.style.display = 'flex';
            const guestContent = authContainer.querySelector('#guest-info-content');
            if (guestContent) guestContent.style.display = 'none';
            updateOwnerButton(); // ✅ ИСПРАВЛЕНИЕ: Вызываем новую функцию для обновления кнопки

            // Стилизация кнопки Выйти
            const logoutButton = authContainer.querySelector('.btn-logout');
            if (logoutButton) {
                logoutButton.style.background = 'linear-gradient(135deg, #6c757d, #495057)';
                logoutButton.style.border = '1px solid #343a40';
                logoutButton.style.color = '#e9ecef';
                logoutButton.style.textShadow = '1px 1px 2px rgba(0,0,0,0.5)';
                logoutButton.style.transition = 'all 0.3s ease';
                logoutButton.onmouseover = () => {
                    logoutButton.style.background = 'linear-gradient(135deg, #f44336, #c62828)';
                    logoutButton.style.borderColor = '#b71c1c';
                };
                logoutButton.onmouseout = () => logoutButton.style.background = 'linear-gradient(135deg, #6c757d, #495057)';
            }
        }
    
        // Вызываем проверку прав немедленно
        await this.ensureUserProfile();
        if (typeof ensureAdminButtonVisible === 'function') {
            console.log('⚙️ Принудительный вызов ensureAdminButtonVisible() после входа...');
            ensureAdminButtonVisible();
        }
        this.checkAndShowAdminPanel();

        // Проверяем VIP доступ
        // console.log('🔍 [updateUIForLoggedInUser] Вызываем checkAndShowVipContent()');
        await this.checkAndShowVipContent();

    // Отключаем старый таймер VIP - теперь используется новый в script.js
        // this.addVipCountdownToHeader();
    }

    // Получение иконки роли
    getRoleIcon(role, isOwner, isVip) {
        if (isOwner || role === 'owner') {
            return '👑'; // Владелец
        }
        if (role === 'admin_senior') {
            return '💎'; // Старший админ
        }
        if (role === 'admin') {
            return '⚡'; // Админ
        }
        if (role === 'moderator_senior') {
            return '🔥'; // Старший модератор
        }
        if (role === 'moderator') {
            return '🛡️'; // Модератор
        }
        return isVip || role === 'vip' ? '💎' : '👤'; // VIP или обычный пользователь
    }

    // Функция для добавления обратного отсчета VIP в шапку
    addVipCountdownToHeader() {
        const usernameDisplay = document.querySelector('#user-identifier');
        if (!usernameDisplay) return;

        if (this.vipCountdownInterval) {
            clearInterval(this.vipCountdownInterval);
        }

        this.getUserRole().then(profile => {
            if (!profile) return;

            const elevatedRoles = ['moderator', 'moderator_senior', 'admin', 'admin_senior', 'owner'];
            const isElevatedRole = elevatedRoles.includes(profile.role);

            if (isElevatedRole) {
                // Сначала очищаем от предыдущих VIP/ролей индикаторов
                let cleanText = usernameDisplay.textContent;
                cleanText = cleanText.replace(/💎♾️/g, '').replace(/♾️/g, '').trim();
                usernameDisplay.innerHTML = `💎<span style="color: #ffd700; font-size: 0.9rem; font-weight: bold; text-shadow: 0 0 10px rgba(255, 215, 0, 0.8);">♾️</span>${cleanText}`;
                return;
            }

            const hasVipStatus = profile.isVip || profile.role === 'vip';
            if (hasVipStatus) {
                if (!profile.vipExpiresAt) {
                    // Проверяем что (Бессрочно) еще не добавлено
                    if (!usernameDisplay.innerHTML.includes('(Бессрочно)')) {
                        usernameDisplay.innerHTML += ' <span style="color: #ffd700; font-size: 0.75rem; font-weight: bold;">(Бессрочно)</span>';
                    }
                    return;
                }
                const updateVipTimeDisplay = () => {
                    const remainingMs = new Date(profile.vipExpiresAt).getTime() - new Date().getTime();
                    let vipTimeInfo = '';

                    if (remainingMs <= 0) {
                        vipTimeInfo = ' <span style="color: #ff4444; font-size: 0.75rem; font-weight: bold;">(Истёк)</span>';
                        clearInterval(this.vipCountdownInterval);
                        
                        // Обновляем VIP-статус в базе данных
                        if (window.supabase && profile.id) {
                            window.supabase
                                .from('profiles')
                                .update({ 
                                    is_vip: false, 
                                    vip_expires_at: null 
                                })
                                .eq('id', profile.id)
                                .then(({ error }) => {
                                    if (!error) {
                                        console.log('✅ VIP-статус деактивирован в базе данных');
                                        // Перезагружаем страницу для обновления интерфейса
                                        setTimeout(() => location.reload(), 2000);
                                    } else {
                                        console.error('❌ Ошибка деактивации VIP:', error);
                                    }
                                });
                        }
                    } else {
                        // ✅ ИСПРАВЛЕНИЕ: Рассчитываем общее количество часов, минут и секунд.
                        const totalSeconds = Math.floor(remainingMs / 1000);
                        const hours = Math.floor(totalSeconds / 3600);
                        const minutes = Math.floor((totalSeconds % 3600) / 60);
                        const seconds = totalSeconds % 60;
                        vipTimeInfo = ` <span style="color: #ffd700; font-size: 0.75rem; font-weight: bold;">(${hours}ч ${minutes}м ${seconds}с)</span>`;
                    }
                    
                    const cleanHtml = usernameDisplay.innerHTML.replace(/ <span style="[^"]+">\([^)]+\)<\/span>$/, '');
                    usernameDisplay.innerHTML = cleanHtml + vipTimeInfo;
                };
                // ✅ ИСПРАВЛЕНИЕ: Обновляем таймер каждую секунду для отображения секунд.
                this.vipCountdownInterval = setInterval(updateVipTimeDisplay, 1000);
            }
        });
    }

    // Обновление UI для неавторизованного пользователя
    updateUIForLoggedOutUser() {
        const authContainer = document.getElementById('auth-container');
        const guestInfoTemplate = document.getElementById('guest-info-template');

        if (authContainer && guestInfoTemplate) {
            const isImpersonating = sessionStorage.getItem('impersonatedUser');
            const isUserViewMode = sessionStorage.getItem('isUserViewMode') === 'true';

            // ИСПРАВЛЕНИЕ: Показываем кнопки гостя, только если мы НЕ в режиме просмотра.
            if (!this.getCurrentUser() && !isImpersonating && !isUserViewMode) {
                console.log('🔧 Пользователь - гость. Вставляем кнопки входа/регистрации.');
                authContainer.innerHTML = guestInfoTemplate.innerHTML;
            }
        }

        // Очищаем обратный отсчет VIP при выходе
        if (this.vipCountdownInterval) {
            clearInterval(this.vipCountdownInterval);
            this.vipCountdownInterval = null;
        }

        const adminPanelElement = document.getElementById('admin-panel');
        if (adminPanelElement) adminPanelElement.style.display = 'none';

        // Принудительно скрываем VIP-раздел при выходе
        const vipLink = document.getElementById('vip-section-link');
        if (vipLink) {
            vipLink.style.display = 'none !important';
        }

        // Скрываем VIP категории и кнопку для гостей
        const vipCategories = document.getElementById('vip_modsCategories');
        if (vipCategories) {
            vipCategories.style.display = 'none';
        }

        const vipGameButton = document.querySelector('.game-btn[data-game="vip_mods"]');
        if (vipGameButton) {
            vipGameButton.style.display = 'none';
        }

        // Если текущая версия - vip_mods, переключаем на FS25
        if (window.modsManager && window.modsManager.currentGameVersion === 'vip_mods') {
            window.switchGameVersion('fs25');
        }

        // Принудительно скрываем контейнер VIP-статуса в боковой панели
        const sidebarVipContainer = document.getElementById('sidebar-vip-status-container');
        if (sidebarVipContainer) {
            sidebarVipContainer.innerHTML = ''; // Очищаем содержимое
            sidebarVipContainer.style.display = 'none'; // И скрываем сам контейнер
        }
    }

    // Проверка и показ VIP-раздела
    async checkAndShowVipContent() {
        // console.log('🔍 [checkAndShowVipContent] Начало проверки VIP доступа');
        // console.log('🔍 [checkAndShowVipContent] currentUser:', this.currentUser);
        // console.log('🔍 [checkAndShowVipContent] impersonatedUser:', sessionStorage.getItem('impersonatedUser'));
        // console.log('🔍 [checkAndShowVipContent] isUserViewMode:', sessionStorage.getItem('isUserViewMode'));

        if (!this.currentUser) {
            // console.log('❌ Нет текущего пользователя');
            return;
        }

        try {
            let profileToCheck;
            const impersonatedUserStr = sessionStorage.getItem('impersonatedUser');
            const isUserViewMode = sessionStorage.getItem('isUserViewMode') === 'true';

            if (isUserViewMode) {
                // В режиме просмотра от лица обычного пользователя VIP-раздел всегда скрыт
                profileToCheck = { is_vip: false, role: 'user' };
                console.log('👁️‍🗨️ Режим просмотра от лица пользователя: VIP-раздел скрыт.');
            } else if (impersonatedUserStr) {
                // В режиме имперсонализации проверяем права имперсонируемого пользователя
                profileToCheck = JSON.parse(impersonatedUserStr);
                // console.log('👁️‍🗨️ Режим имперсонализации: проверяем VIP-доступ для', profileToCheck.username);
            } else {
                // В обычном режиме проверяем права текущего пользователя
                // console.log('🔍 [checkAndShowVipContent] Вызываем getUserRole()');
                profileToCheck = await this.getUserRole();
                // console.log('🔍 [checkAndShowVipContent] profileToCheck from getUserRole:', profileToCheck);
                // Добавляем vip_started_at как null для совместимости
                if (profileToCheck) {
                    profileToCheck.vip_started_at = null;
                }
            }

            // console.log('🔍 [checkAndShowVipContent] profileToCheck final:', profileToCheck);

            const vipLink = document.getElementById('vip-section-link');
            const vipCategories = document.getElementById('vip_modsCategories');
            const vipGameButton = document.querySelector('.game-btn[data-game="vip_mods"]');

            // VIP-доступ есть у VIP, модераторов, админов и владельца
            const vipRoles = ['vip', 'moderator', 'moderator_senior', 'admin', 'admin_senior', 'owner'];
            const hasVipAccess = profileToCheck && (profileToCheck.isVip === true || vipRoles.includes(profileToCheck.role) || profileToCheck.isOwner === true);

            // console.log('🔍 [VIP Check] profileToCheck:', profileToCheck, 'vipRoles:', vipRoles, 'hasVipAccess:', hasVipAccess);

            if (hasVipAccess) {
                // console.log('💎 Пользователь (или имперсонируемый) имеет VIP доступ, показываем VIP элементы.');
                if (vipLink) vipLink.style.display = 'inline-block !important';

                // Показываем VIP кнопку
                const vipGameButton = document.querySelector('.game-btn[data-game="vip_mods"]');
                if (vipGameButton) vipGameButton.style.display = 'inline-flex';

                // 🔧 ИСПРАВЛЕНИЕ: Показываем VIP категории если пользователь имеет VIP статус
                const vipCategories = document.getElementById('vip_modsCategories');
                if (vipCategories) {
                    // 🔧 ИСПРАВЛЕНИЕ: Используем profileToCheck вместо currentUser (который не определён)
                    const hasVipStatus = profileToCheck?.isVip === true || profileToCheck?.role === 'vip';
                    if (hasVipStatus) {
                        vipCategories.style.display = 'block';
                        console.log('💎 VIP категории показаны (пользователь имеет VIP статус):', profileToCheck);
                    } else {
                        vipCategories.style.display = 'none';
                        console.log('💎 VIP категории скрыты (пользователь не имеет VIP):', profileToCheck);
                    }
                }

            } else {
                console.log('❌ Пользователь не имеет VIP доступ, скрываем VIP раздел.');
                if (vipLink) vipLink.style.display = 'none !important';

                // 🔧 ИСПРАВЛЕНИЕ: Не удаляем VIP кнопку, а только скрываем
                const vipGameButton = document.querySelector('.game-btn[data-game="vip_mods"]');
                if (vipGameButton) vipGameButton.style.display = 'none';

                // 🔧 ИСПРАВЛЕНИЕ: Не удаляем VIP категории, а только скрываем
                const vipCategories = document.getElementById('vip_modsCategories');
                if (vipCategories) {
                    vipCategories.style.display = 'none';
                    console.log('💎 VIP категории скрыты (нет доступа):', profileToCheck);
                }

                // Если текущая версия - vip_mods, переключаем на FS25
                if (window.modsManager && window.modsManager.currentGameVersion === 'vip_mods') {
                    window.switchGameVersion('fs25');
                }
            }

        } catch (error) {
            console.error('❌ Ошибка проверки VIP-доступа:', error);
        }
    }

    // Проверка и показ админ панели
    async checkAndShowAdminPanel() {
        if (!this.currentUser) {
            console.log('❌ Нет текущего пользователя для проверки админ прав');
            return;
        }

        // Проверяем, активен ли режим просмотра от лица пользователя
        const isUserViewMode = sessionStorage.getItem('isUserViewMode') === 'true'; // Check if guest mode is active
        const isImpersonating = sessionStorage.getItem('impersonatedUser'); // Check if impersonation is active

        if (isUserViewMode || isImpersonating) { // If either is active, hide admin elements and show exit button
            console.log('👁️‍🗨️ Активен режим просмотра от лица пользователя или имперсонализации. Админ-элементы скрыты.'); // Log this
            // Показываем кнопку для выхода из этого режима, если она существует
            if (typeof showExitUserViewButton === 'function') {
                showExitUserViewButton(isImpersonating);
            }
            return; // ВАЖНО: Прерываем выполнение, чтобы не показывать админ-кнопку
        }

        try {
            // Проверяем доступность window.supabase
            if (typeof window.supabase === 'undefined') {
                console.error('❌ Supabase клиент не инициализирован');
                return;
            }

            console.log('🔍 Проверяем права админа для пользователя:', this.currentUser.email);

            let { data: profile, error } = await window.supabase
                .from('profiles')
                .select('role, is_owner, is_vip')
                .eq('id', this.currentUser.id)
                .maybeSingle(); // Используем maybeSingle() для корректной обработки 0 или 1 строки

            if (error) {
                console.error('❌ Ошибка получения профиля:', error);

                // Если ошибка, пробуем создать профиль автоматически
                if (error.code === 'PGRST116' || error.message?.includes('0 rows') || error.message?.includes('Object')) {
                    console.log('🔧 Профиль не найден, создаем автоматически...');
                    try { // Добавляем try-catch для безопасного создания
                        // Проверяем, что this.currentUser существует перед использованием
                        if (!this.currentUser) {
                            throw new Error("Не удалось получить данные текущего пользователя для создания профиля.");
                        }
                        // Правильно извлекаем username из метаданных или генерируем из email
                        let username = this.currentUser.user_metadata?.username;
                        if (!username) {
                            username = this.currentUser.email.split('@')[0].toLowerCase();
                            console.log('📧 Генерируем username из email для нового профиля:', username);
                        }

                        // Получаем IP адрес через RPC вызов
                        const { data: ipData, error: ipError } = await window.supabase.rpc('get_ip_address');
                        if (ipError) console.warn('⚠️ Не удалось получить IP адрес при авто-создании профиля:', ipError.message);

                        await this.createUserProfile(this.currentUser, username, this.currentUser.email, await this.generateDeviceFingerprint(), ipData);
                        console.log('✅ Профиль создан автоматически');

                        // Пробуем получить профиль снова
                        const { data: newProfile, error: retryError } = await window.supabase
                            .from('profiles')
                            .select('role, is_owner, is_vip') // Выбираем те же поля
                            .eq('id', this.currentUser.id)
                            .single();

                        if (!retryError && newProfile) {
                            // Если успешно, используем новые данные
                            console.log('✅ Профиль получен после создания:', newProfile);
                            // Обновляем hasAdminAccess с новыми данными
                            profile = newProfile;
                        } else {
                            if (retryError) console.error("❌ Ошибка при повторном получении профиля:", retryError);
                            // Если и после создания не получили, считаем, что прав нет
                            profile = { role: 'user', is_owner: false };
                        }
                    } catch (createError) {
                        console.error('❌ Ош��бка создания профиля:', createError);
                        // Если создать профиль не удалось, считаем, что прав нет
                        profile = { role: 'user', is_owner: false };
                    }
                } else {
                     // Если ошибка не связана с отсутствием профиля, то прекращаем выполнение
                    return; 
                }
            }

            if (!profile) {
                console.warn('⚠️ Профиль пользователя не найден. Возможно, он еще не создан.');
                return;
            }

            // ИСПРАВЛЕНИЕ: Объединяем логику доступа к админ-панели для всех административных ролей.
            const hasPanelAccess = ['owner', 'admin_senior', 'admin', 'moderator_senior', 'moderator'].includes(profile.role);
            const isOwner = profile.is_owner === true || profile.role === 'owner';
            
            let adminBtn = document.querySelector('#admin-panel-button');

            console.log('👤 Пользователь:', this.currentUser.email, '| Роль:', profile.role, '| Владелец:', profile.is_owner, '| Доступ к панели:', hasPanelAccess);

            // Если старая кнопка не найдена в шаблоне, это может быть ошибкой, но мы должны продолжить
            // и попытаться показать новую кнопку `.owner-auth-button`

            if (hasPanelAccess) {
                // console.log('✅ Пользователь имеет права на доступ к панели, показываем кнопку');

                if (adminBtn) {
                    adminBtn.style.display = 'inline-flex';
                    // Убираем дублирующееся имя пользователя, так как оно уже есть в #user-identifier
                    // adminBtn.innerHTML = ''; // Очищаем содержимое кнопки

                    if (isOwner) {
                        adminBtn.innerHTML = `👑 Владелец`;
                        adminBtn.style.background = 'linear-gradient(270deg, #ff1a1a, #ffd700, #ff1a1a)';
                        adminBtn.style.backgroundSize = '200% 200%';
                        adminBtn.style.animation = 'redGoldGradientShift 3s ease infinite';
                        adminBtn.style.color = '#000';
                        adminBtn.style.border = '2px solid #ffd700';
                        adminBtn.style.boxShadow = '0 0 15px rgba(255, 215, 0, 0.5)';
                        adminBtn.style.transition = 'all 0.2s ease-in-out';

                        // Добавляем правильный эффект при наведении
                        adminBtn.onmouseover = () => {
                            adminBtn.style.boxShadow = '0 0 25px rgba(255, 215, 0, 0.8)';
                            adminBtn.style.transform = 'scale(1.02)';
                        };
                        adminBtn.onmouseout = () => {
                            adminBtn.style.boxShadow = '0 0 15px rgba(255, 215, 0, 0.5)';
                            adminBtn.style.transform = 'scale(1)';
                        };
                    } else if (profile.role === 'admin_senior') { // Старший админ
                        adminBtn.innerHTML = `💎 Ст. Админ-панель`;
                        adminBtn.style.background = 'linear-gradient(270deg, #e91e63, #9c27b0, #e91e63)';
                        adminBtn.style.backgroundSize = '200% 200%';
                        adminBtn.style.animation = 'redGoldGradientShift 3s ease-in-out infinite'; // Улучшенная анимация
                        adminBtn.style.color = '#fff';
                        adminBtn.style.border = '2px solid #e91e63';
                        adminBtn.style.textShadow = '1px 1px 2px rgba(0,0,0,0.5)';
                    } else if (profile.role === 'admin') { // Админ
                        adminBtn.innerHTML = `⚡ Админ-панель`;
                        adminBtn.style.background = 'linear-gradient(270deg, #ff5252, #ffff99, #ff5252)';
                        adminBtn.style.backgroundSize = '200% 200%';
                        adminBtn.style.animation = 'redGoldGradientShift 3s ease-in-out infinite'; // Улучшенная анимация
                        adminBtn.style.color = '#b71c1c'; // Темно-красный цвет текста
                        adminBtn.style.textShadow = '1px 1px 2px rgba(255,255,255,0.5)'; // Легкая тень для читаемости
                        adminBtn.style.border = '2px solid #f44336';
                        adminBtn.style.boxShadow = '0 0 15px rgba(244, 67, 54, 0.5)';
                    } else if (profile.role === 'moderator_senior') { // Старший модератор
                        adminBtn.innerHTML = `🔥 Ст. Модер-панель`;
                        adminBtn.style.background = 'linear-gradient(270deg, #ff9800, #ffeb3b, #ff9800)';
                        adminBtn.style.backgroundSize = '200% 200%';
                        adminBtn.style.animation = 'redGoldGradientShift 4s ease-in-out infinite'; // Улучшенная анимация
                        adminBtn.style.color = '#000';
                        adminBtn.style.border = '2px solid #ff9800';
                    } else if (profile.role === 'moderator') { // Модератор
                        adminBtn.innerHTML = `🛡️ Панель модератора`;
                        adminBtn.style.background = 'linear-gradient(270deg, #ffd700, #2196f3, #ffd700)';
                        adminBtn.style.backgroundSize = '200% 200%';
                        adminBtn.style.animation = 'redGoldGradientShift 4s ease-in-out infinite'; // Улучшенная анимация
                        adminBtn.style.color = '#fff';
                        adminBtn.style.border = '2px solid #2196f3';
                        adminBtn.style.textShadow = '1px 1px 2px rgba(0,0,0,0.5)';
                    }

                    adminBtn.onclick = () => {
                        // Все роли (включая владельца) должны вводить пароль
                        console.log('🔐 Требуем ввод пароля для всех ролей...');
                        if (typeof showPasswordModal === 'function') {
                            showPasswordModal(() => {
                                console.log('🔓 Пароль введен, открываем админ-панель');
                                if (typeof showAdminPanelReliable === 'function') {
                                    showAdminPanelReliable();
                                } else if (typeof showAdminPanel === 'function') {
                                    showAdminPanel();
                                } else {
                                    console.error('Функция для открытия админ-панели не найдена!');
                                    alert('Ошибка: функция для открытия админ-панели не найдена.');
                                }
                            });
                        } else {
                            console.error('Функция showPasswordModal не найдена!');
                            alert('Ошибка: функция для ввода пароля не найдена.');
                        }
                    };
                    // console.log('✅ Админ кнопка показана');
                }
            }  else {
                console.log('❌ Пользователь не имеет прав админа');
                if (adminBtn) {
                    adminBtn.style.display = 'none';
                    adminBtn.remove(); // Также удаляем, чтобы не мешать
                }
            }
        } catch (error) {
            console.error('❌ Критическая ошибка проверки прав админа:', error);
        }
    }

    // Подписка на изменения профиля пользователя в реальном времени
    subscribeToProfileChanges() {
        if (!this.currentUser || this.profileChangesChannel) {
            return;
        }

        console.log(`📡 Подписка на изменения профиля для пользователя ${this.currentUser.id}`);

        this.profileChangesChannel = window.supabase
            .channel(`profile-changes-for-${this.currentUser.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles'
                    // Убираем filter, чтобы слушать все изменения профилей
                },
                (payload) => {
                    console.log('🔄 Обнаружено изменение профиля:', payload.new);

                    // Обновляем кешированный профиль только если это профиль текущего пользователя
                    if (payload.new.id === this.currentUser.id) {
                        console.log('🔄 Изменен профиль текущего пользователя');

                        if (this.currentUser) {
                            this.currentUser.profile = {
                                role: payload.new.role,
                                isOwner: payload.new.is_owner,
                                isVip: payload.new.is_vip,
                                vipExpiresAt: payload.new.vip_expires_at,
                                vipStartedAt: payload.new.vip_started_at
                            };
                            console.log('✅ Обновлен кешированный профиль:', this.currentUser.profile);
                        }

                        // Показываем уведомление
                        if (typeof showNotification === 'function') {
                            showNotification(
                                'Ваши права доступа были изменены администратором. Обновляем интерфейс...',
                                'info',
                                3000
                            );
                        }

                        // Обновляем UI без перезагрузки страницы
                        setTimeout(async () => {
                            console.log('🔄 Обновляем UI после изменения профиля');
                            await this.updateUIForLoggedInUser();
                            await this.checkAndShowVipContent();
                            await this.checkAndShowAdminPanel();
                        }, 1000);
                    } else {
                        console.log('🔄 Изменен профиль другого пользователя, игнорируем');
                    }
                }
            )
            .subscribe();

        // Подписываемся на личные уведомления для текущего пользователя
        const privateChannelName = `private-user-channel-${this.currentUser.id}`;
        console.log(`📡 Подписка на приватный канал: ${privateChannelName}`);

        window.supabase
            .channel(privateChannelName)
            .on('broadcast', { event: 'private_notification' }, (payload) => {
                console.log('🔔 Получено приватное уведомление:', payload);
                const { title, message } = payload.payload;

                if (title && message && typeof showNotification === 'function') {
                    // Показываем уведомление с более длинной задержкой
                    showNotification(`${title}\n${message}`, 'info', 10000);
                }
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log(`✅ Успешная подписка на приватный канал: ${privateChannelName}`);
                }
            });
    }

    // Загрузка пользовательских предпочтений
    loadUserPreferences() {
        const preferences = storageManager.getLocalStorage('userPreferences');
        if (preferences) {
            // Применяем настройки темы, языка и т.д.
            this.applyUserPreferences(preferences);
        }
    }

    // Очистка пользовательских предпочтений
    clearUserPreferences() {
        storageManager.setLocalStorage('userPreferences', null);
    }

    // Применение пользовательских предпочтений
    applyUserPreferences(preferences) {
        // Здесь можно добавить логику применения настроек
        if (preferences.theme) {
            document.body.className = preferences.theme;
        }
    }

    // Проверка статуса аккаунта
    async checkAccountStatus() {
        if (!this.currentUser) return;

        try {
            // Проверяем доступность window.supabase
            if (typeof window.supabase === 'undefined') {
                throw new Error('Supabase клиент не инициализирован');
            }

            const { data: profile, error } = await window.supabase
                .from('profiles')
                .select('is_banned, ban_reason')
                .eq('id', this.currentUser.id)
                .maybeSingle();

            if (error) {
                console.error('❌ Ошибка Supabase при проверке статуса аккаунта:', error);
                throw error;
            }

            if (profile && profile.is_banned) {
                this.handleBannedAccount(profile.ban_reason);
            }
        } catch (error) {
            console.warn('Ошибка проверки статуса аккаунта:', error);
        }
    }

    // Обработка заблокированного аккаунта
    handleBannedAccount(reason) {
        const modal = document.createElement('div');
        modal.className = 'ban-modal';
        modal.innerHTML = `
            <div class="ban-content">
                <h3>Аккаунт заблокирован</h3>
                <p>Причина: ${reason || 'Нарушение правил'}</p>
                <p>Обратитесь к администрации для разблокировки</p>
                <button onclick="location.reload()">Обновить страницу</button>
            </div>
        `;
        document.body.appendChild(modal);

        // Выход из аккаунта
        this.logoutUser();
    }

    // Настройка обработчиков событий
    setupEventListeners() {
        // Ждем инициализации Supabase
        if (typeof window.supabase === 'undefined') {
            console.warn('Supabase еще не инициализирован, ждем...');
            setTimeout(() => this.setupEventListeners(), 100);
            return;
        }

        // Обработчик изменения состояния аутентификации
        window.supabase.auth.onAuthStateChange((event, session) => {
            switch (event) {
                case 'SIGNED_IN':
                    this.currentUser = session.user;
                    this.saveUserSession();
                    this.restoreUserState();
                    break;
                case 'SIGNED_OUT':
                    this.currentUser = null;
                    this.clearUserSession();
                    this.clearUserState();
                    break;
                case 'TOKEN_REFRESHED':
                    this.saveUserSession();
                    break;
            }
        });
    }

    // Загрузка настроек из хранилища
    loadSettings() {
        // Загружаем настройки аутентификации
        const authSettings = storageManager.getLocalStorage('authSettings');
        if (authSettings) {
            this.sessionTimeout = authSettings.sessionTimeout || this.sessionTimeout;
            this.adminSessionTimeout = authSettings.adminSessionTimeout || this.adminSessionTimeout;
        }
    }

    // Получение текущего пользователя
    getCurrentUser() {
        return this.currentUser;
    }

// Применение пользовательских предпочтений
applyUserPreferences(preferences) {
    // Здесь можно добавить логику применения настроек
    if (preferences.theme) {
        document.body.className = preferences.theme;
    }
}

// Проверка статуса аккаунта
async checkAccountStatus() {
    if (!this.currentUser) return;

    try {
        // Проверяем доступность window.supabase
        if (typeof window.supabase === 'undefined') {
            throw new Error('Supabase клиент не инициализирован');
        }

        const { data: profile, error } = await window.supabase
            .from('profiles')
            .select('is_banned, ban_reason')
            .eq('id', this.currentUser.id)
            .maybeSingle();

        if (error) {
            console.error('❌ Ошибка Supabase при проверке статуса аккаунта:', error);
            throw error;
        }

        if (profile && profile.is_banned) {
            this.handleBannedAccount(profile.ban_reason);
        }
    } catch (error) {
        console.warn('Ошибка проверки статуса аккаунта:', error);
    }
}

// Обработка заблокированного аккаунта
handleBannedAccount(reason) {
    const modal = document.createElement('div');
    modal.className = 'ban-modal';
    modal.innerHTML = `
        <div class="ban-content">
            <h3>Аккаунт заблокирован</h3>
            <p>Причина: ${reason || 'Нарушение правил'}</p>
            <p>Обратитесь к администрации для разблокировки</p>
            <button onclick="location.reload()">Обновить страницу</button>
        </div>
    `;
    document.body.appendChild(modal);

    // Выход из аккаунта
    this.logoutUser();
}

// Настройка обработчиков событий
setupEventListeners() {
    // Ждем инициализации Supabase
    if (typeof window.supabase === 'undefined') {
        console.warn('Supabase еще не инициализирован, ждем...');
        setTimeout(() => this.setupEventListeners(), 100);
        return;
    }

    // Обработчик изменения состояния аутентификации
    window.supabase.auth.onAuthStateChange((event, session) => {
        switch (event) {
            case 'SIGNED_IN':
                this.currentUser = session.user;
                this.saveUserSession();
                this.restoreUserState();
                break;
            case 'SIGNED_OUT':
                this.currentUser = null;
                this.clearUserSession();
                this.clearUserState();
                break;
            case 'TOKEN_REFRESHED':
                this.saveUserSession();
                break;
        }
    });
}

// Загрузка настроек из хранилища
loadSettings() {
    // Загружаем настройки аутентификации
    const authSettings = storageManager.getLocalStorage('authSettings');
    if (authSettings) {
        this.sessionTimeout = authSettings.sessionTimeout || this.sessionTimeout;
        this.adminSessionTimeout = authSettings.adminSessionTimeout || this.adminSessionTimeout;
    }
}

// Получение текущего пользователя
getCurrentUser() {
    return this.currentUser;
}

// Проверка авторизации
isAuthenticated() {
    return this.currentUser !== null;
}

// Получение роли пользователя
async getUserRole(forceUpdate = false) {
    // Если активен режим просмотра как гость, всегда возвращаем null
    if (sessionStorage.getItem('isUserViewMode') === 'true') {
        // console.log('👁️‍🗨️ [getUserRole] Режим гостя активен, роль не определена.');
        return null;
    }

    if (!this.currentUser) {
        // console.log('❌ [getUserRole] Нет текущего пользователя');
        return null;
    }

    // ПРОВЕРКА РЕЖИМА ИМПЕРСОНАЛИЗАЦИИ: если активен, возвращаем профиль целевого пользователя
    const impersonatedUserStr = sessionStorage.getItem('impersonatedUser');
    if (impersonatedUserStr) {
        try {
            const impersonatedUser = JSON.parse(impersonatedUserStr);
            // console.log('👁️‍🗨️ [getUserRole] Режим имперсонации активен для:', impersonatedUser.username);
            
            // Возвращаем профиль имперсонируемого пользователя
            return { 
                role: impersonatedUser.role,
                isOwner: impersonatedUser.isOwner,
                isVip: impersonatedUser.isVip,
                username: impersonatedUser.username
            };
        } catch (e) {
            console.warn('👁️‍🗨️ [getUserRole] Ошибка парсинга имперсонации:', e);
        }
    }

    // 🔧 ИСПРАВЛЕНИЕ: Проверяем кеш, если не требуется принудительное обновление
    if (!forceUpdate && this.currentUser.profile) {
        console.log('🔍 [getUserRole] Используем кешированный профиль:', this.currentUser.profile);
        return this.currentUser.profile;
    }

    // Получаем профиль текущего пользователя из Supabase
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', this.currentUser.id)
        .single();

    if (error) {
        console.warn('⚠️ [getUserRole] Ошибка загрузки профиля:', error);
        return {
            role: 'user',
            isOwner: false,
            isVip: false
        };
    }

    if (!profile) {
        // console.log('ℹ️ Профиль не найден в getUserRole, возвращаем роль "user" по умолчанию.');
        return {
            role: 'user',
            isOwner: false,
            isVip: false
        };
    }

    // Формируем объект профиля
    const userProfile = {
        role: profile.role || 'user',
        isOwner: profile.is_owner || false,
        isVip: profile.is_vip || false,
        vipExpiresAt: profile.vip_expires_at,
        vipStartedAt: profile.vip_started_at,
    };

    // console.log('🔍 [getUserRole] userProfile:', userProfile);

    // Кешируем профиль
    if (this.currentUser) this.currentUser.profile = userProfile;

    return userProfile;
}

// Получение роли конкретного пользователя по ID
async getUserRoleById(userId) {
    console.log(`🔍 [getUserRoleById] Получение роли для пользователя: ${userId}`);
    
    if (!userId) {
        console.log('❌ [getUserRoleById] userId не указан');
        return null;
    }

    // Получаем профиль пользователя из Supabase
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (error) {
        console.warn(`⚠️ [getUserRoleById] Ошибка загрузки профиля для ${userId}:`, error);
        return {
            role: 'user',
            isOwner: false,
            isVip: false
        };
    }

    if (!profile) {
        console.log(`ℹ️ [getUserRoleById] Профиль не найден для ${userId}, возвращаем роль "user" по умолчанию.`);
        return {
            role: 'user',
            isOwner: false,
            isVip: false
        };
    }

    // Формируем объект профиля
    const userProfile = {
        role: profile.role || 'user',
        isOwner: profile.is_owner || false,
        isVip: profile.is_vip || false,
        vipExpiresAt: profile.vip_expires_at,
        vipStartedAt: profile.vip_started_at,
        username: profile.username
    };

    console.log(` [getUserRoleById] Роль для ${profile.username}:`, userProfile);
    return userProfile;
}

}

// Глобальный экземпляр
const authManager = new AuthManager();

// Глобальные функции для обратной совместимости

// Функция обработки выхода пользователя (используется в HTML)
async function handleLogout(confirmLogout = true) {
    if (confirmLogout) {
        if (!confirm('Вы уверены, что хотите выйти?')) {
            return { success: false, message: 'Выход отменен пользователем' };
        }
    }
    try {
        console.log('🚪 Пользователь нажал кнопку выхода');
        const result = await authManager.logoutUser();

        if (result.success) {
            console.log('✅ Пользователь успешно вышел из системы');

            // Обновляем UI для неавторизованного пользователя
            const userInfo = document.querySelector('#user-info');
            const guestInfo = document.querySelector('#guest-info');

            if (userInfo) userInfo.style.display = 'none';
            if (guestInfo) guestInfo.style.display = 'block';

            // Скрываем админ панель если она открыта
            const adminPanel = document.querySelector('#admin-panel');
            if (adminPanel) adminPanel.style.display = 'none';

            console.log('✅ UI обновлен для неавторизованного пользователя');
        }

        return result;
    } catch (error) {
        console.error('❌ Ошибка при выходе пользователя:', error);
        throw error;
    }
}

async function initializeAuth() {
    return await authManager.initialize();
}

async function registerUser(email, password, username) {
    return await authManager.registerUser(email, password, username);
}

async function loginUser(login, password) {
    return await authManager.loginUser(login, password);
}

async function logoutUser() {
    return await authManager.logoutUser();
}

function getCurrentUser() {
    return authManager.getCurrentUser();
}

function isAuthenticated() {
    return authManager.isAuthenticated();
}

async function getUserRole(forceUpdate = false) {
    return await authManager.getUserRole(forceUpdate);
}

async function getUserRoleById(userId) {
    return await authManager.getUserRoleById(userId);
}

// Диагностическая функция для проверки аутентификации
async function diagnoseAuthIssue() {
    try {
        console.log('🔍 Диагностика проблем аутентификации...');

        // Проверяем доступность Supabase
        if (typeof window.supabase === 'undefined') {
            console.error('❌ Supabase клиент не инициализирован');
            return { error: 'Supabase клиент не инициализирован' };
        }

        // Проверяем текущего пользователя
        const currentUser = authManager.getCurrentUser();
        console.log('👤 Текущий пользователь:', currentUser);

        // Проверяем локальное хранилище
        const keys = Object.keys(localStorage).filter(key => key.includes('window.supabase') || key.includes('auth'));
        console.log('🔑 Ключи аутентификации в localStorage:', keys);

        // Проверяем сессию
        const sessionData = storageManager.getLocalStorage('userSession');
        console.log('💾 Данные сессии:', sessionData);

        // Пробуем получить текущую сессию Supabase
        const { data: session, error: sessionError } = await window.supabase.auth.getSession();
        console.log(' Текущая сессия Supabase:', session, 'Ошибка:', sessionError);

        return {
            currentUser,
            authKeys: keys,
            sessionData,
            supabaseSession: session,
            supabaseError: sessionError
        };
    } catch (error) {
        console.error(' Ошибка диагностики:', error);
        return { error: error.message };
    }
}

function checkAndShowAdminPanel() {
    return authManager.checkAndShowAdminPanel();
}

// Глобальная заглушка для обратной совместимости: переключение UI в режим гостя
function updateUIForGuest() {
    try {
        authManager.updateUIForLoggedOutUser();
        // Дополнительно показываем подсказку пользователю на русском (если есть уведомления)
        if (typeof showNotification === 'function') {
            try { showNotification('Вы вошли как гость. Войдите или зарегистрируйтесь.', 'info'); } catch (_) {}
        }
    } finally {
        // Добавляем пропущенную закрывающую фигурную скобку
    }
}

// Экспорт для модулей
window.authManager = authManager;
window.initializeAuth = initializeAuth;
window.registerUser = registerUser;
window.loginUser = loginUser;
window.logoutUser = logoutUser;
window.handleLogout = handleLogout;
window.getCurrentUser = getCurrentUser;
window.isAuthenticated = isAuthenticated;
window.getUserRole = getUserRole;
window.getUserRoleById = getUserRoleById;
window.checkAndShowAdminPanel = checkAndShowAdminPanel;
window.updateUIForGuest = updateUIForGuest;
window.diagnoseAuthIssue = diagnoseAuthIssue;
window.forceRefreshUserSession = () => authManager.forceRefreshUserSession();

// Дополнительный экспорт для исправлений админ кнопки
window.getRoleName = function(role) { // ИСПРАВЛЕНИЕ: Делаем глобальной
    const names = {
        'user': 'Пользователь',
        'vip': 'VIP',
        'moderator': 'Модератор',
        'moderator_senior': 'Старший Модератор',
        'admin': 'Админ',
        'admin_senior': 'Старший Админ',
        'owner': 'Владелец'
    };
    return names[role] || role;
};

console.log('✅ Модуль системы аутентификации загружен');

// Глобальная функция getRoleIcon для использования вне контекста класса
window.getRoleIcon = function(role, isOwner, isVip) {
    if (isOwner || role === 'owner') {
        return '👑'; // Владелец
    }
    if (role === 'admin_senior') {
        return '💎'; // Старший админ
    }
    if (role === 'admin') {
        return '⚡'; // Админ
    }
    if (role === 'moderator_senior') {
        return '🔥'; // Старший модератор
    }
    if (role === 'moderator') {
        return '🛡️'; // Модератор
    }
    return isVip || role === 'vip' ? '💎' : '👤'; // VIP или обычный пользователь
};

// ✅ ИСПРАВЛЕНИЕ: Новая централизованная функция для обновления кнопки владельца/админа
function updateOwnerButton() {
    const authContainer = document.getElementById('auth-container');
    if (!authContainer) return;

    const currentUser = window.authManager ? window.authManager.getCurrentUser() : null;
    if (!currentUser) return;

    window.authManager.getUserRole().then(profile => {
        if (!profile) return;

        const hasAccess = profile.isOwner === true || ['owner', 'admin_senior', 'admin', 'moderator', 'moderator_senior'].includes(profile.role);

        if (hasAccess) {
            const username = currentUser.user_metadata?.username || currentUser.email.split('@')[0];
            let icon = '👤';
            let roleText = 'Пользователь';
            let roleClass = 'user';

            if (profile.isOwner === true || profile.role === 'owner') {
                icon = '👑';
                roleText = 'Владелец';
                roleClass = 'owner';
            } else if (profile.role === 'admin_senior') {
                icon = '💎';
                roleText = 'Старший Админ';
                roleClass = 'admin_senior';
            } else if (profile.role === 'admin') {
                icon = '⚡';
                roleText = 'Админ';
                roleClass = 'admin';
            } else if (profile.role === 'moderator_senior') {
                icon = '🔥';
                roleText = 'Старший Модер';
                roleClass = 'moderator_senior';
            } else if (profile.role === 'moderator') {
                icon = '🛡️';
                roleText = 'Модератор';
                roleClass = 'moderator';
            }

            // Находим существующую кнопку админа и обновляем ее
            let adminBtn = authContainer.querySelector('#admin-panel-button');
            if (adminBtn) {
                adminBtn.className = 'owner-auth-button'; // Применяем новый стиль
                adminBtn.style.display = 'inline-flex';
                adminBtn.setAttribute('data-role', roleClass);
                adminBtn.innerHTML = `${icon} ${roleText}`;
                adminBtn.title = roleText;
                adminBtn.onclick = showOwnerPanel; // Убедимся, что обработчик правильный
                console.log('✅ Кнопка администратора обновлена:', username, roleClass);
            }
        }
    }).catch(error => {
        console.error('Ошибка получения роли пользователя при обновлении кнопки:', error);
    });
}