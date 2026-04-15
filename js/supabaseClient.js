// Supabase Client Configuration
(function() {
    // Отключаем логи если DEBUG_MODE выключен
    if (typeof DEBUG_MODE === 'undefined') window.DEBUG_MODE = false;
    
    if (false) { // Отключаем отключение логов
        const originalConsoleLog = console.log;
        console.log = function(...args) {
            // Не выводим ничего если DEBUG_MODE отключен
        };
    }
    
    // Supabase configuration из script.js
    const SUPABASE_URL = 'https://gtixajbcfxwqrtsdxnif.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhhamJjZnh3cXJ0c2R4bmlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1MDUwMTIsImV4cCI6MjA3NjA4MTAxMn0.T3Wvz0UPTG1O4NFS54PzfyB4sJdNLdiGT9GvnvJKGzw';

    // 🔧 ИСПРАВЛЕНИЕ: Добавляем таймаут и повторные попытки
    const SUPABASE_TIMEOUT = 10000; // 10 секунд таймаут
    const MAX_RETRIES = 3; // Максимум 3 попытки
    let retryCount = 0;
    
    // Функция инициализации Supabase
    function initializeSupabase() {
        // Проверяем доступность Supabase CDN
        if (window.DEBUG_MODE) console.log('🔍 Проверяем доступность Supabase CDN...');
        if (window.DEBUG_MODE) console.log('🔍 window.supabase:', typeof window.supabase);
        if (window.DEBUG_MODE) console.log('🔍 window.supabase.createClient:', typeof window.supabase?.createClient);
        
        if (typeof window !== 'undefined' && window.supabase && window.supabase.createClient) {
            if (window.DEBUG_MODE) console.log('✅ Создаем Supabase клиент с правильными учетными данными...');
            
            try {
                // Создаем клиент с правильными настройками
                const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                    auth: {
                        storage: window.safeLocalStorage || localStorage,
                        persistSession: true,
                        autoRefreshToken: true,
                    },
                    global: {
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json'
                        }
                    },
                    db: {
                        schema: 'public'
                    }
                });
                
                if (window.DEBUG_MODE) console.log('🔍 Проверяем созданный клиент:');
                if (window.DEBUG_MODE) console.log('🔍 client.from:', typeof client.from);
                if (window.DEBUG_MODE) console.log('🔍 client.auth:', typeof client.auth);
                
                // Устанавливаем глобальные переменные
                // НЕ перезаписываем window.supabase, используем существующий клиент
                window.supabaseClient = client;
                
                // Если window.supabase еще не установлен или это заглушка
                if (!window.supabase || !window.supabase.from || typeof window.supabase.from !== 'function') {
                    window.supabase = client;
                    if (window.DEBUG_MODE) console.log('✅ Установлен новый Supabase клиент в window.supabase');
                } else {
                    if (window.DEBUG_MODE) console.log('✅ Используем существующий Supabase клиент');
                }
                
                // Проверяем что функции доступны
                if (window.DEBUG_MODE) console.log('🔍 Финальная проверка window.supabase.from:', typeof window.supabase.from);
                if (window.DEBUG_MODE) console.log('🔍 Финальная проверка window.supabase.from().select:', typeof window.supabase.from ? typeof window.supabase.from('test').select : 'undefined');
                
                // ВРЕМЕННО ОТКЛЮЧАЕМ ПЕРЕХВАТЧИК ДЛЯ ТЕСТИРОВАНИЯ STORAGE
                if (window.DEBUG_MODE) console.log('🔧 Временно отключаем перехватчик fetch для тестирования Storage');
                // Перехватчик временно отключен - используем оригинальный fetch
                
                /*
                // Добавляем агрессивный перехватчик для всех Supabase запросов
                const originalFetch = window.fetch;
                window.fetch = function(...args) {
                    const [url, options = {}] = args;
                    
                    if (url && url.includes('supabase.co')) {
                        // НЕ трогаем Storage запросы - они должны работать с оригинальными заголовками
                        if (url.includes('/storage/v1/')) {
                            console.log('🔧 Storage request - оригинальные заголовки:', url, options.headers);
                            return originalFetch(url, options);
                        }
                        
                        // Auth запросы тоже не трогаем
                        if (url.includes('/auth/v1/')) {
                            console.log('🔧 Auth request - оригинальные заголовки:', url, options.headers);
                            return originalFetch(url, options);
                        }
                        
                        // Только для REST запросов модифицируем заголовки
                        if (url.includes('/rest/v1/')) {
                            const newOptions = { ...options };
                            
                            if (!newOptions.headers) {
                                newOptions.headers = {};
                            }
                            
                            // Устанавливаем заголовки только для REST
                            newOptions.headers['Accept'] = 'application/json';
                            newOptions.headers['Content-Type'] = 'application/json';
                            newOptions.headers['apikey'] = SUPABASE_ANON_KEY;
                            newOptions.headers['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`;
                            
                            console.log('🔧 REST request - модифицированные заголовки:', url, newOptions.headers);
                            return originalFetch(url, newOptions);
                        }
                        
                        // Для других Supabase запросов
                        const newOptions = { ...options };
                        if (!newOptions.headers) {
                            newOptions.headers = {};
                        }
                        newOptions.headers['apikey'] = SUPABASE_ANON_KEY;
                        newOptions.headers['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`;
                        
                        console.log('🔧 Other Supabase request:', url, newOptions.headers);
                        return originalFetch(url, newOptions);
                    }
                    
                    return originalFetch.apply(this, args);
                };
                */
                
                if (window.DEBUG_MODE) console.log('✅ Supabase клиент успешно инициализирован');
                if (window.DEBUG_MODE) console.log('🔑 Supabase URL:', SUPABASE_URL);
                if (window.DEBUG_MODE) console.log('🔑 Supabase клиент готов к работе');

                // 🔧 ИСПРАВЛЕНИЕ: Добавляем глобальный обработчик ошибок сети
                window.addEventListener('online', () => {
                    console.log('🌐 Сеть восстановлена. Переподключение к Supabase...');
                    if (!window.supabaseReady) {
                        initializeSupabase();
                    }
                });

                window.addEventListener('offline', () => {
                    console.warn('⚠️ Сеть недоступна. Работа в офлайн режиме...');
                    showNotification('⚠️ Нет подключения к интернету. Работа в офлайн режиме.', 'warning', 3000);
                });

                // Устанавливаем флаг готовности
                window.supabaseReady = true;
                
                // Загружаем настройки сайта после инициализации Supabase
                if (typeof window.loadSiteSettings === 'function') {
                    if (window.DEBUG_MODE) console.log('🔧 Загружаем настройки сайта после инициализации Supabase...');
                    window.loadSiteSettings().catch(error => {
                        console.error('❌ Ошибка загрузки настроек сайта:', error);
                    });
                    
                    // Подписываемся на изменения настроек в реальном времени
                    try {
                        window.supabase
                            .channel('site-settings-sync')
                            .on('postgres_changes', { 
                                event: '*', 
                                schema: 'public', 
                                table: 'site_settings',
                                filter: 'setting_key=in.(allow_user_mod_upload,require_mod_approval)'
                            }, async (payload) => {
                                if (window.DEBUG_MODE) console.log('🔄 Получено обновление настроек сайта:', payload);
                                if (typeof window.loadSiteSettings === 'function') {
                                    await window.loadSiteSettings();
                                }
                            })
                            .subscribe();
                        if (window.DEBUG_MODE) console.log('✅ Подписка на изменения настроек сайта активирована');
                    } catch (error) {
                        console.warn('⚠️ Не удалось подписаться на изменения настроек:', error);
                    }
                }
                
                return true;
                
            } catch (error) {
                console.error('❌ Ошибка при создании Supabase клиента:', error);
                
                // 🔧 ИСПРАВЛЕНИЕ: Повторные попытки при ошибке
                retryCount++;
                if (retryCount < MAX_RETRIES) {
                    console.log(`🔄 Попытка ${retryCount}/${MAX_RETRIES}. Повторная инициализация через 2 секунды...`);
                    setTimeout(() => {
                        console.log('🔄 Повторная инициализация Supabase...');
                        initializeSupabase();
                    }, 2000);
                } else {
                    console.error(`❌ Не удалось инициализировать Supabase после ${MAX_RETRIES} попыток`);
                    showNotification('⚠️ Проблемы с подключением к базе данных. Некоторые функции могут не работать.', 'warning', 5000);
                    createFallbackClient();
                }
                return false;
            }
        } else {
            if (window.DEBUG_MODE) console.warn('⚠️ Supabase CDN не загружен. Создаем заглушку.');
            createFallbackClient();
            return false;
        }
    }
    
    // Функция создания заглушки
    function createFallbackClient() {
        window.supabase = {
            from: function(table) {
                console.warn(`⚠️ Supabase не настроен. Запрос к таблице "${table}" не будет выполнен.`);
                return {
                    select: function(columns = '*') {
                        console.warn(`⚠️ Запрос select(${columns}) к таблице "${table}" не будет выполнен.`);
                        return {
                            eq: function(column, value) {
                                console.warn(`⚠️ Фильтр eq("${column}", ${value}) не будет выполнен.`);
                                return this;
                            },
                            in: function(column, values) {
                                console.warn(`⚠️ Фильтр in("${column}", [${values}]) не будет выполнен.`);
                                return this;
                            },
                            order: function(column, options) {
                                console.warn(`⚠️ Сортировка order("${column}", ${JSON.stringify(options)}) не будет выполнена.`);
                                return Promise.resolve({ data: [], error: new Error('Supabase клиент не инициализирован') });
                            },
                            limit: function(count) {
                                console.warn(`⚠️ Лимит limit(${count}) не будет применен.`);
                                return this;
                            },
                            single: function() {
                                console.warn(`⚠️ Запрос single() не будет выполнен.`);
                                return Promise.resolve({ data: null, error: new Error('Supabase клиент не инициализирован') });
                            }
                        };
                    }
                };
            },
            auth: {
                getUser: () => {
                    console.warn('⚠️ Аутентификация не настроена.');
                    return Promise.resolve({ data: { user: null }, error: new Error('Auth не настроен') });
                },
                getSession: () => {
                    console.warn('⚠️ Сессия не настроена.');
                    return Promise.resolve({ data: { session: null }, error: new Error('Session не настроен') });
                },
                onAuthStateChange: () => {
                    console.warn('⚠️ Отслеживание состояния аутентификации не настроено.');
                    return { data: { subscription: null } };
                }
            },
            channel: function(channel) {
                console.warn(`⚠️ Realtime канал "${channel}" не настроен.`);
                return {
                    on: () => ({ 
                        subscribe: () => ({ 
                            data: { subscription: null } 
                        }) 
                    })
                };
            }
        };
        window.supabaseClient = window.supabase;
        
        // Устанавливаем значения по умолчанию для настроек
        window.userModUploadsEnabled = false;
        window.modApprovalRequired = false;
        
        // console.log('🔧 Установлены значения по умолчанию для настроек сайта');
    }
    
    // Инициализация немедленно
    // console.log('🔄 Инициализация Supabase клиента...');
    initializeSupabase();
})();
