// Модуль безопасности админ-панели с единым паролем
if (typeof DEBUG_MODE === 'undefined') window.DEBUG_MODE = false;

if (false) { // Отключаем отключение логов
    const originalConsoleLog = console.log;
    console.log = function(...args) {
        // Не выводим ничего если DEBUG_MODE отключен
    };
}

if (typeof AdminPanelSecurity === 'undefined') {
class AdminPanelSecurity {
    constructor() {
        this.isPasswordChecked = false;
        this.passwordModal = null;
        this.pendingCallback = null;
        
        if (window.DEBUG_MODE) console.log('🔐 Конструктор AdminPanelSecurity вызван');
        
        // Создаем модальное окно
        this.setupPasswordModal();
        
        // Добавляем отложенную инициализацию перехвата
        this.delayedInterceptInit();
        
        if (window.DEBUG_MODE) console.log('🔐 AdminPanelSecurity полностью инициализирован');
    }
    
    // Отложенная инициализация перехвата
    delayedInterceptInit() {
        // ОТКЛЮЧАЕМ ПЕРЕХВАТ ФУНКЦИЙ
        // Проверка ролей теперь происходит в auth-system.js
        if (window.DEBUG_MODE) console.log('🔐 Перехват функций отключен - проверка происходит в auth-system.js');
    }

    // Создание модального окна для ввода пароля
    setupPasswordModal() {
        // Проверяем, что DOM загружен
        if (!document.body) {
            console.error('❌ DOM еще не загружен, откладываю создание модального окна');
            // Пробуем снова через 100мс
            setTimeout(() => this.setupPasswordModal(), 100);
            return;
        }
        
        console.log('🔐 Создаю модальное окно...');
        const modalHTML = `
            <div id="admin-password-modal" class="password-modal" style="
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                z-index: 10000;
                backdrop-filter: blur(5px);
            ">
                <div style="
                    background: linear-gradient(135deg, #8b0000, #4b0000), linear-gradient(45deg, #ff4757, #ffd700, #ff4757);
                    background-size: 400% 400%;
                    border: 2px solid #f44336;
                    border-radius: 15px;
                    padding: 30px;
                    max-width: 400px;
                    width: 90%;
                    text-align: center;
                    animation: passwordModalGradient 3s ease infinite;
                    box-shadow: 0 0 40px rgba(255, 71, 87, 0.5), 0 0 80px rgba(255, 215, 0, 0.3);
                    margin: auto;
                ">
                    <div id="admin-password-modal-header" style="
                        cursor: move;
                        user-select: none;
                        padding: 10px;
                        margin: -30px -30px 20px -30px;
                        background: rgba(255, 215, 0, 0.1);
                        border-radius: 15px 15px 0 0;
                        border-bottom: 2px solid rgba(255, 215, 0, 0.3);
                    ">
                    <h2 style="
                        color: #ffd700;
                        margin: 0;
                        font-size: 24px;
                        font-weight: bold;
                        text-shadow: 0 0 15px rgba(255, 215, 0, 0.8);
                    ">🔐 ДОСТУП К АДМИН-ПАНЕЛИ</h2>
                    </div>
                    
                    <p style="
                        color: #8892b0;
                        margin-bottom: 25px;
                        font-size: 14px;
                    ">Введите пароль для доступа к админ-панели</p>
                    
                    <div style="position: relative; margin-bottom: 20px;">
                        <input 
                            type="password" 
                            id="admin-password-input"
                            placeholder="Введите пароль..."
                            style="
                                width: 100%;
                                padding: 12px 40px 12px 12px;
                                background: rgba(0, 0, 0, 0.5);
                                border: 1px solid #00ff41;
                                border-radius: 8px;
                                color: #ffffff;
                                font-size: 16px;
                                box-sizing: border-box;
                            "
                        />
                        <button 
                            type="button"
                            onclick="toggleAdminPasswordVisibility(this)"
                            style="
                                position: absolute;
                                right: 12px;
                                top: 50%;
                                transform: translateY(-50%);
                                background: none;
                                border: none;
                                color: #8892b0;
                                cursor: pointer;
                                font-size: 18px;
                                padding: 5px;
                                transition: color 0.3s ease;
                            "
                            title="Показать/скрыть пароль"
                        >👁️</button>
                    </div>
                    
                    <div style="display: flex; gap: 10px; justify-content: center;">
                        <button 
                            id="admin-password-submit"
                            style="
                                background: linear-gradient(135deg, #00ff41, #00cc33);
                                color: #000;
                                border: none;
                                padding: 12px 30px;
                                border-radius: 8px;
                                font-weight: bold;
                                cursor: pointer;
                                font-size: 14px;
                                transition: all 0.3s ease;
                            "
                            onmouseover="this.style.transform='scale(1.05)'"
                            onmouseout="this.style.transform='scale(1)'"
                        >
                            ✅ Войти
                        </button>
                        
                        <button 
                            id="admin-password-cancel"
                            style="
                                background: linear-gradient(135deg, #ff4757, #ff3838);
                                color: #fff;
                                border: none;
                                padding: 12px 30px;
                                border-radius: 8px;
                                font-weight: bold;
                                cursor: pointer;
                                font-size: 14px;
                                transition: all 0.3s ease;
                            "
                            onmouseover="this.style.transform='scale(1.05)'"
                            onmouseout="this.style.transform='scale(1)'"
                        >
                            ❌ Отмена
                        </button>
                    </div>
                    
                    <div id="admin-password-error" style="
                        color: #ff4757;
                        margin-top: 15px;
                        font-size: 12px;
                        min-height: 20px;
                    "></div>
                </div>
            </div>
            
            <style>
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                
                @keyframes slideIn {
                    from { 
                        transform: translate(-50%, -50%) scale(0.8);
                        opacity: 0;
                    }
                    to { 
                        transform: translate(-50%, -50%) scale(1);
                        opacity: 1;
                    }
                }
            </style>
        `;

        // Проверяем, что DOM загружен перед добавлением модального окна
        if (!document.body) {
            console.error('❌ DOM еще не загружен, не могу добавить модальное окно');
            return;
        }
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.passwordModal = document.getElementById('admin-password-modal');
        this.setupEventListeners();
    }

    // Настройка обработчиков событий
    setupEventListeners() {
        const submitBtn = document.getElementById('admin-password-submit');
        const cancelBtn = document.getElementById('admin-password-cancel');
        const passwordInput = document.getElementById('admin-password-input');
        const modalHeader = document.getElementById('admin-password-modal-header');

        if (submitBtn) {
            submitBtn.addEventListener('click', () => this.checkPassword());
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.closePasswordModal());
        }

        if (passwordInput) {
            passwordInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.checkPassword();
                }
            });
        }

        // Закрытие модального окна при клике вне его
        this.passwordModal.addEventListener('click', (e) => {
            if (e.target === this.passwordModal) {
                this.closePasswordModal();
            }
        });

        // Добавляем функциональность перетаскивания
        this.makeModalDraggable(modalHeader);
    }

    // Делаем модальное окно перемещаемым
    makeModalDraggable(header) {
        if (!header) return;

        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        const modalContent = header.parentElement;
        const modalContainer = this.passwordModal;

        header.addEventListener('mousedown', dragStart);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', dragEnd);

        function dragStart(e) {
            if (e.target.tagName === 'BUTTON') return; // Не перетаскивать при клике на кнопки

            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;

            // Получаем текущую позицию модального окна
            const rect = modalContent.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;

            // Убираем центрирование и делаем позиционирование абсолютным
            modalContent.style.position = 'fixed';
            modalContent.style.left = initialLeft + 'px';
            modalContent.style.top = initialTop + 'px';
            modalContent.style.margin = 'auto';
            modalContent.style.transform = 'none';
            
            // Отключаем анимацию при перетаскивании
            modalContent.style.transition = 'none';
        }

        function drag(e) {
            if (!isDragging) return;

            e.preventDefault();

            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;

            const newLeft = initialLeft + deltaX;
            const newTop = initialTop + deltaY;

            // Ограничиваем движение в пределах видимой области
            const siteWidth = window.innerWidth;
            const siteHeight = window.innerHeight;
            const modalWidth = modalContent.offsetWidth;
            const modalHeight = modalContent.offsetHeight;

            const maxX = siteWidth - modalWidth;
            const maxY = siteHeight - modalHeight;

            const finalLeft = Math.max(0, Math.min(newLeft, maxX));
            const finalTop = Math.max(0, Math.min(newTop, maxY));

            modalContent.style.left = finalLeft + 'px';
            modalContent.style.top = finalTop + 'px';
        }

        function dragEnd(e) {
            if (!isDragging) return;
            
            isDragging = false;
            // Возвращаем анимацию
            modalContent.style.transition = '';
        }
    }

    // Перехват вызовов функций админ-панели - ОТКЛЮЧЕНО
    // Проверка ролей теперь происходит в auth-system.js
    interceptAdminPanelAccess() {
        console.log('🔐 Перехват функций отключен - проверка происходит в auth-system.js');
        // Ничего не делаем - перехват отключен
    }

    // Требование пароля перед выполнением действия
    requirePassword(callback) {
        console.log('🔐 Проверяем пароль для доступа к админ-панели...');
        
        // Если пароль уже проверен в текущей сессии
        if (this.isPasswordChecked) {
            console.log('🔐 Пароль уже введен в текущей сессии, пропускаем');
            callback();
            return;
        }

        console.log('🔐 Требуем ввод пароля...');
        // Показываем модальное окно для ввода пароля
        this.showPasswordModal(callback);
    }

    // Показ модального окна
    showPasswordModal(callback) {
        console.log('🔐 [DEBUG] showPasswordModal вызван с callback:', typeof callback);
        this.pendingCallback = callback;
        console.log('🔐 [DEBUG] pendingCallback установлен:', !!this.pendingCallback);
        this.passwordModal.classList.add('show');
        
        // Фокус на поле ввода пароля
        setTimeout(() => {
            const passwordInput = document.getElementById('admin-password-input');
            if (passwordInput) {
                passwordInput.focus();
            }
        }, 100);
    }

    // Закрытие модального окна
    closePasswordModal() {
        console.log('🔐 [DEBUG] closePasswordModal вызван');
        console.log('🔐 [DEBUG] pendingCallback перед очисткой:', !!this.pendingCallback);
        this.passwordModal.classList.remove('show');
        // НЕ очищаем pendingCallback здесь - он нужен для вызова после успешной проверки пароля
        // this.pendingCallback = null; // УБРАНО!
        
        // Сбрасываем позицию модального окна при закрытии
        const modalContent = document.getElementById('admin-password-modal-header')?.parentElement;
        if (modalContent) {
            modalContent.style.position = '';
            modalContent.style.left = '';
            modalContent.style.top = '';
            modalContent.style.margin = 'auto';
            modalContent.style.transform = '';
        }
    }

    // Проверка пароля через вашу базу данных
    async checkPassword() {
        console.log('🔐 [DEBUG] checkPassword вызван');
        console.log('🔐 [DEBUG] pendingCallback в начале checkPassword:', !!this.pendingCallback);
        console.log('🔐 [DEBUG] тип pendingCallback в начале checkPassword:', typeof this.pendingCallback);
        
        const passwordInput = document.getElementById('admin-password-input');
        const errorDiv = document.getElementById('admin-password-error');
        const submitBtn = document.getElementById('admin-password-submit');
        
        const password = passwordInput.value.trim();
        
        if (!password) {
            errorDiv.textContent = '❌ Введите пароль';
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Проверка...';
        errorDiv.textContent = '';

        try {
            console.log('🔐 [DEBUG] Проверяем пароль:', password ? '***' : 'empty');
            
            // Проверяем доступность Supabase
            if (!window.supabase) {
                throw new Error('Supabase не инициализирован');
            }
            
            const { data, error } = await window.supabase.rpc('check_admin_panel_password', {
                p_password: password
            });

            console.log('🔐 [DEBUG] Ответ от Supabase:', { data, error });

            if (error) {
                console.error('❌ [DEBUG] Ошибка Supabase:', error);
                // Если RPC функция не существует, используем резервную проверку
                if (error.code === 'PGRST202' || error.message?.includes('function') || error.message?.includes('Failed to fetch')) {
                    console.log('🔐 RPC функция недоступна, используем резервную проверку...');
                    return await this.fallbackPasswordCheck(password);
                }
                throw error;
            }

            if (data) {
                this.isPasswordChecked = true;
                errorDiv.textContent = '';
                this.closePasswordModal();
                console.log('🔐 [DEBUG] Проверяем pendingCallback перед вызовом:', !!this.pendingCallback);
                console.log('🔐 [DEBUG] Тип pendingCallback:', typeof this.pendingCallback);
                if (this.pendingCallback) {
                    console.log('✅ [DEBUG] Вызываем callback функцию');
                    this.pendingCallback();
                    this.pendingCallback = null;
                } else {
                    console.log('❌ [DEBUG] pendingCallback не установлен!');
                }
                console.log('✅ Доступ к админ-панели разрешен');
            } else {
                errorDiv.textContent = '❌ Неверный пароль. Попробуйте еще раз.';
                passwordInput.value = '';
                passwordInput.focus();
            }
        } catch (error) {
            console.error('❌ [DEBUG] Ошибка проверки пароля:', error);
            
            if (error.code === 'PGRST202') {
                errorDiv.textContent = '❌ Функция проверки пароля не найдена. Обратитесь к администратору.';
            } else {
                errorDiv.textContent = '❌ Ошибка сервера: ' + error.message;
            }
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = '✅ Войти';
        }
    }

    // Смена пароля админ-панели
    async changePassword(currentPassword, newPassword) {
        try {
            console.log('🔐 Начинаю смену пароля...');
            console.log('🔐 [DEBUG] Текущий пароль:', currentPassword ? '***' : 'empty');
            console.log('🔐 [DEBUG] Новый пароль:', newPassword ? '***' : 'empty');
            
            // Сначала получаем текущий пароль из базы данных
            const { data: settings, error: settingsError } = await window.supabase
                .from('admin_settings')
                .select('setting_value')
                .eq('setting_key', 'admin_password')
                .maybeSingle();
            
            console.log('🔐 [DEBUG] Ответ от Supabase (текущий пароль):', { data: settings, error: settingsError });
            
            if (settingsError) {
                console.error('❌ Не удалось получить текущий пароль из базы данных:', settingsError);
                throw new Error('Не удалось получить текущий пароль. Обратитесь к администратору.');
            } else if (!settings) {
                console.error('❌ Пароль не найден в базе данных');
                throw new Error('Пароль не установлен. Обратитесь к администратору.');
            } else {
                // Проверяем текущий пароль из базы данных
                const currentStoredPassword = settings.setting_value.trim(); // Обрезаем пробелы
                const enteredPassword = currentPassword.trim(); // Обрезаем пробелы
                
                console.log('🔐 [DEBUG] Пароль из базы (с пробелами):', settings.setting_value);
                console.log('🔐 [DEBUG] Пароль из базы (обрезанный):', currentStoredPassword);
                console.log('🔐 [DEBUG] Введенный пароль (с пробелами):', currentPassword);
                console.log('🔐 [DEBUG] Введенный пароль (обрезанный):', enteredPassword);
                
                if (currentStoredPassword !== enteredPassword) {
                    console.log('❌ [DEBUG] Пароли не совпадают!');
                    return {
                        success: false,
                        message: 'Неверный текущий пароль'
                    };
                }
                console.log('✅ [DEBUG] Текущий пароль верен!');
            }
            
            // Проверяем новый пароль
            if (newPassword.length < 6) {
                console.log('❌ [DEBUG] Новый пароль слишком короткий');
                return {
                    success: false,
                    message: 'Новый пароль должен содержать минимум 6 символов'
                };
            }
            
            if (currentPassword === newPassword) {
                console.log('❌ [DEBUG] Новый пароль совпадает с текущим');
                return {
                    success: false,
                    message: 'Новый пароль должен отличаться от текущего'
                };
            }
            
            console.log('✅ Проверки пройдены, обновляем пароль...');
            
            // Обновляем пароль в базе данных
            const { error: updateError } = await window.supabase
                .from('admin_settings')
                .upsert({
                    setting_key: 'admin_password',
                    setting_value: newPassword.trim(), // Обрезаем пробелы
                    setting_type: 'string',
                    description: 'Пароль администратора',
                    updated_by: window.currentUser?.email || 'unknown'
                });
            
            console.log('🔐 [DEBUG] Ответ от Supabase (обновление пароля):', { error: updateError });
            
            if (updateError) {
                throw new Error('Ошибка обновления пароля: ' + updateError.message);
            }
            
            // Обновляем дату последней смены пароля
            const now = new Date().toISOString();
            const { error: dateError } = await window.supabase
                .from('admin_settings')
                .upsert({
                    setting_key: 'password_last_changed',
                    setting_value: now,
                    setting_type: 'timestamp',
                    description: 'Время последней смены пароля',
                    updated_by: window.currentUser?.email || 'unknown'
                });
            
            console.log('🔐 [DEBUG] Ответ от Supabase (обновление даты):', { error: dateError });
            
            if (dateError) {
                console.warn('⚠️ Не удалось обновить дату смены пароля:', dateError);
            } else {
                console.log('✅ Дата последней смены пароля обновлена:', now);
            }
            
            console.log('✅ Пароль успешно изменен в базе данных');
            
            return {
                success: true,
                message: 'Пароль успешно изменен'
            };
            
        } catch (error) {
            console.error('❌ Ошибка смены пароля:', error);
            return {
                success: false,
                message: error.message || 'Произошла ошибка при смене пароля'
            };
        }
    }

    // Получение информации об админ-панели
    async getAdminPanelInfo() {
        try {
            console.log('🔐 Загрузка информации об админ-панели...');
            
            // Получаем все настройки из admin_settings
            const { data, error } = await window.supabase
                .from('admin_settings')
                .select('*');
            
            if (error) {
                console.error('❌ Ошибка загрузки настроек:', error);
                // Возвращаем значения по умолчанию если таблица не существует
                return {
                    admin_password: null,
                    password_last_changed: 'unknown',
                    panel_enabled: true
                };
            }
            
            // Преобразуем настройки в объект
            const settings = {};
            if (data) {
                data.forEach(setting => {
                    settings[setting.setting_key] = setting.setting_value;
                });
            }
            
            console.log('✅ Настройки админ-панели загружены:', settings);
            return settings;
            
        } catch (error) {
            console.error('❌ Ошибка получения информации:', error);
            // Возвращаем значения по умолчанию
            return {
                admin_password: null,
                password_last_changed: 'unknown',
                panel_enabled: true
            };
        }
    }
}

// Создаем глобальный экземпляр с проверкой готовности
function initializeAdminPanelSecurity() {
    // Проверяем, что DOM загружен и Supabase доступен
    if (document.readyState === 'loading') {
        console.log('🔐 DOM еще не загружен, ждем...');
        document.addEventListener('DOMContentLoaded', initializeAdminPanelSecurity);
        return;
    }
    
    if (!window.supabase) {
        console.log('🔐 Supabase еще не инициализирован, ждем...');
        setTimeout(initializeAdminPanelSecurity, 100);
        return;
    }
    
    console.log('🔐 Создаем AdminPanelSecurity...');
    window.adminPanelSecurity = new AdminPanelSecurity();
    
    console.log('🔐 Модуль безопасности админ-панели загружен');
    console.log('🔐 Проверяем доступность функций:', {
        showAdminPanel: typeof window.showAdminPanel,
        showAdminPanelReliable: typeof window.showAdminPanelReliable,
        adminPanelSecurity: !!window.adminPanelSecurity
    });
}

// Запускаем инициализацию
initializeAdminPanelSecurity();

// Глобальная функция для совместимости с auth-system.js
function showPasswordModal(callback) {
    console.log('🔐 [DEBUG] showPasswordModal вызван с callback:', typeof callback);
    console.log('🔐 [DEBUG] callback значение:', callback);
    
    if (window.adminPanelSecurity && typeof window.adminPanelSecurity.showPasswordModal === 'function') {
        return window.adminPanelSecurity.showPasswordModal(callback);
    }
    console.error('❌ adminPanelSecurity не найден или метод showPasswordModal не доступен');
}

// Экспортируем глобально
window.showPasswordModal = showPasswordModal;

// Функция для переключения видимости пароля в модальном окне
function toggleAdminPasswordVisibility(button) {
    const input = document.getElementById('admin-password-input');
    if (input.type === 'password') {
        input.type = 'text';
        button.textContent = '🙈';
        button.title = 'Скрыть пароль';
        button.style.color = '#00ff41';
    } else {
        input.type = 'password';
        button.textContent = '👁️';
        button.title = 'Показать/скрыть пароль';
        button.style.color = '#8892b0';
    }
}

// Резервная проверка пароля на клиенте
AdminPanelSecurity.prototype.fallbackPasswordCheck = async function(password) {
    console.log('🔐 [DEBUG] Резервная проверка пароля:', password ? '***' : 'empty');
    
    // Простая проверка hardcoded пароля
    const validPasswords = ['KEROS1289', 'KEROS1980'];
    const isValid = validPasswords.includes(password);
    
    if (isValid) {
        this.isPasswordChecked = true;
        const errorDiv = document.getElementById('admin-password-error');
        if (errorDiv) errorDiv.textContent = '';
        this.closePasswordModal();
        
        console.log('✅ [DEBUG] Резервная проверка пройдена, вызываем callback');
        if (this.pendingCallback) {
            this.pendingCallback();
            this.pendingCallback = null;
        }
        console.log('✅ Доступ к админ-панелю разрешен (резервная проверка)');
    } else {
        const errorDiv = document.getElementById('admin-password-error');
        if (errorDiv) {
            errorDiv.textContent = '❌ Неверный пароль. Попробуйте еще раз.';
        }
        const passwordInput = document.getElementById('admin-password-input');
        if (passwordInput) {
            passwordInput.value = '';
            passwordInput.focus();
        }
        console.log('❌ Неверный пароль (резервная проверка)');
    }
}

// Добавляем CSS анимацию для переливающегося фона модального окна
const modalAnimationStyle = document.createElement('style');
modalAnimationStyle.textContent = `
    #admin-password-modal {
        display: none !important;
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important;
        background: rgba(0, 0, 0, 0.8) !important;
        z-index: 10000 !important;
        backdrop-filter: blur(5px) !important;
    }
    
    #admin-password-modal.show {
        display: flex !important;
        justify-content: center !important;
        align-items: center !important;
    }
    
    @keyframes passwordModalGradient {
        0% {
            background-position: 0% 50%;
            box-shadow: 0 0 40px rgba(255, 71, 87, 0.5), 0 0 80px rgba(255, 215, 0, 0.3);
        }
        25% {
            background-position: 50% 25%;
            box-shadow: 0 0 50px rgba(255, 71, 87, 0.7), 0 0 100px rgba(255, 215, 0, 0.4);
        }
        50% {
            background-position: 100% 50%;
            box-shadow: 0 0 60px rgba(255, 215, 0, 0.5), 0 0 120px rgba(255, 71, 87, 0.4);
        }
        75% {
            background-position: 50% 75%;
            box-shadow: 0 0 50px rgba(255, 71, 87, 0.7), 0 0 100px rgba(255, 215, 0, 0.4);
        }
        100% {
            background-position: 0% 50%;
            box-shadow: 0 0 40px rgba(255, 71, 87, 0.5), 0 0 80px rgba(255, 215, 0, 0.3);
        }
    }
`;
document.head.appendChild(modalAnimationStyle);

// Экспорт глобальных функций для совместимости
window.showPasswordModal = showPasswordModal;
window.AdminPanelSecurity = AdminPanelSecurity;

} // Закрываем блок проверки существования класса
