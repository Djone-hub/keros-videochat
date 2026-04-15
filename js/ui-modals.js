// js/ui-modals.js
// Модуль для управления модальными окнами сайта

let shopVipCountdownInterval = null; // Глобальный интервал для таймера в магазине

/**
 * Показывает всплывающее уведомление.
 * @param {string} message - Сообщение для показа.
 * @param {string} type - Тип уведомления ('success', 'error', 'info').
 * @param {number} duration - Длительность показа в миллисекундах.
 */
function showNotification(message, type = 'info', duration = 4000) {
    // console.log(' [ui-modals.js] showNotification вызвана:', { message, type, duration });
    
    // Создаем контейнер для уведомлений, если его еще нет
    let notificationContainer = document.getElementById('notification-container');
    if (!notificationContainer) {
        // console.log(' [ui-modals.js] Создаем контейнер для уведомлений');
        notificationContainer = document.createElement('div');
        notificationContainer.id = 'notification-container';
        notificationContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999999;
            display: flex;
            flex-direction: column;
            gap: 10px;
            pointer-events: none;
            max-width: 400px;
        `;
        document.body.appendChild(notificationContainer);
        // console.log(' [ui-modals.js] Контейнер добавлен в body');
    } else {
        // console.log(' [ui-modals.js] Контейнер уже существует, дочерних элементов:', notificationContainer.children.length);
    }

    const notification = document.createElement('div');
    notification.textContent = message;
    // console.log(' [ui-modals.js] Создан элемент уведомления');

    // Стили
    const colors = {
        success: 'linear-gradient(135deg, #4CAF50, #66BB6A)',
        error: 'linear-gradient(135deg, #f44336, #E57373)',
        info: 'linear-gradient(135deg, #2196F3, #64B5F6)'
    };

    notification.style.cssText = `
        padding: 10px 18px;
        border-radius: 6px;
        color: white;
        font-weight: bold;
        font-size: 14px;
        background: ${colors[type] || colors['info']};
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        opacity: 0;
        transform: translateX(100%);
        transition: all 0.4s cubic-bezier(0.68, -0.55, 0.27, 1.55);
        position: relative !important;
        display: block !important;
        visibility: visible !important;
    `;

    notificationContainer.appendChild(notification);
    // console.log(' [ui-modals.js] Уведомление добавлено в контейнер');

    // Анимация появления и исчезновения
    setTimeout(() => {
        // console.log(' [ui-modals.js] Запускаем анимацию появления');
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(0)';
    }, 10);

    setTimeout(() => {
        // console.log(' [ui-modals.js] Запускаем анимацию исчезновения');
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            // console.log(' [ui-modals.js] Удаляем уведомление');
            notification.remove();
        }, 400);
    }, duration);
}

// Показ модального окна входа
function showLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.style.display = 'block';
        // Фокус на поле email
        setTimeout(() => {
            const emailInput = document.getElementById('loginEmail');
            if (emailInput) emailInput.focus();
        }, 100);
    }
}

// Скрытие модального окна входа
function hideLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Показ модального окна регистрации
function showRegisterModal() {
    const modal = document.getElementById('registerModal');
    if (modal) {
        modal.style.display = 'block';
        // ИСПРАВЛЕНИЕ: Сначала показываем модальное окно, а затем, с небольшой задержкой,
        // инициализируем обработчики событий. Это гарантирует, что все элементы
        // формы (поля пароля, индикаторы) уже существуют в DOM.
        setTimeout(() => {
            // Инициализируем проверку пароля при открытии окна
            initializePasswordChecks();
            // Фокус на поле email
            const emailInput = document.getElementById('registerEmail');
            if (emailInput) emailInput.focus();
        }, 100);
    }
}

// Скрытие модального окна регистрации
function hideRegisterModal() {
    const modal = document.getElementById('registerModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Показ модального окна восстановления пароля
function showPasswordResetModal() {
    const modal = document.getElementById('passwordResetModal');
    if (modal) {
        modal.style.display = 'block';

        // Очищаем форму и показываем первый шаг
        setTimeout(() => {
            document.getElementById('resetStep1').style.display = 'block';
            document.getElementById('resetStep2').style.display = 'none';

            const emailInput = document.getElementById('resetEmail');
            if (emailInput) {
                emailInput.value = '';
                emailInput.focus();
            }

            // Скрываем сообщения
            const resetMessage = document.getElementById('resetMessage');
            if (resetMessage) {
                resetMessage.style.display = 'none';
            }
        }, 100);
    }
}

// Скрытие модального окна восстановления пароля
function hidePasswordResetModal() {
    const modal = document.getElementById('passwordResetModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

/**
 * ✅ ВОССТАНОВЛЕННАЯ ФУНКЦИЯ
 * Обрабатывает отправку формы регистрации.
 * @param {Event} event - Событие отправки формы.
 */
async function handleRegister(event) {
    event.preventDefault();

    const username = document.getElementById('registerUsername').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const passwordConfirm = document.getElementById('registerPasswordConfirm').value;

    if (password !== passwordConfirm) {
        showNotification('❌ Пароли не совпадают!', 'error');
        return;
    }

    if (password.length < 6) {
        showNotification('❌ Пароль должен быть не менее 6 символов.', 'error');
        return;
    }

    try {
        // Вызываем метод из authManager для регистрации
        const result = await authManager.registerUser(email, password, username);

        if (result.success) {
            hideRegisterModal();
            document.getElementById('registerForm').reset();
            showNotification('✅ Регистрация почти завершена! Проверьте ваш email для подтверждения.', 'success');
        }
        // В случае ошибки, authManager.registerUser сам покажет уведомление

    } catch (error) {
        // authManager.registerUser уже обрабатывает и показывает ошибки,
        // поэтому здесь дополнительная обработка не требуется.
        console.error('Критическая ошибка в handleRegister:', error);
    }
}

/**
 * Показывает модальное окно с правилами сайта.
 */
function showRulesModal() {
    // Удаляем существующие модальные окна, чтобы избежать дублирования
    const existingModal = document.querySelector('.rules-modal');
    if (existingModal) {
        existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.className = 'rules-modal';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(10, 25, 47, 0.8); backdrop-filter: blur(5px);
        display: flex; justify-content: center; align-items: center; z-index: 100001;
        opacity: 0; transition: opacity 0.3s ease;
    `;

    modal.innerHTML = `
        <div style="background: linear-gradient(135deg, #112240, #1a2f5e); border-radius: 15px; padding: 2rem; width: 90%; max-width: 600px; box-shadow: 0 15px 30px rgba(0,0,0,0.4); border: 1px solid rgba(0,204,255,0.3); transform: scale(0.9); transition: transform 0.3s ease;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid rgba(0,204,255,0.2);">
                <h4 style="color: #00ccff; margin: 0; text-shadow: 0 0 5px #00ccff;">📜 Правила сайта KEROS MODS</h4>
                <button onclick="this.closest('.rules-modal').remove()" class="hacker-btn" style="background: #f44336; color: white; padding: 0.5rem 1rem; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">❌</button>
            </div>
            <div style="color: #ccd6f6; font-size: 0.9rem; max-height: 60vh; overflow-y: auto; padding-right: 10px;">
                <p><strong>1. Общие положения:</strong></p>
                <ul style="padding-left: 20px; line-height: 1.6;">
                    <li>Уважайте других участников сообщества. Оскорбления, троллинг и разжигание конфликтов запрещены.</li>
                    <li>Запрещена публикация спама, флуда и любой несанкционированной рекламы.</li>
                    <li>Все публикуемые материалы должны соответствовать законодательству.</li>
                </ul>
                <p><strong>2. Публикация модов:</strong></p>
                <ul style="padding-left: 20px; line-height: 1.6;">
                    <li>Запрещено загружать вредоносные файлы, вирусы или майнеры.</li>
                    <li>Указывайте реального автора мода. Присвоение чужих работ запрещено.</li>
                    <li>Моды проходят обязательную модерацию перед публикацией на сайте.</li>
                </ul>
                <p><strong>3. Ответственность:</strong></p>
                <ul style="padding-left: 20px; line-height: 1.6;">
                    <li>Администрация не несет ответственности за возможный вред, причиненный скачанными файлами.</li>
                    <li>За нарушение правил предусмотрены санкции: от предупреждения до перманентной блокировки аккаунта.</li>
                </ul>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Плавное появление
    setTimeout(() => {
        modal.style.opacity = '1';
        modal.querySelector('div[style*="background"]').style.transform = 'scale(1)';
    }, 10);
}

/**
 * Показывает модальное окно магазина.
 */
async function showShopModal() {
    console.log('🔍 [DEBUG] showShopModal вызвана!');
    
    // Проверяем авторизацию пользователя
    const currentUser = window.authManager?.getCurrentUser() || window.supabase.auth.currentUser;
    console.log('🔍 [DEBUG] currentUser =', currentUser);
    
    const modal = document.getElementById('shopModal');
    console.log('🔍 [DEBUG] modal =', modal);
    
    if (modal) {
        // Обновляем текст с ником пользователя
        const descriptionElement = modal.querySelector('p[style*="text-align: center"]');
        console.log('🔍 [DEBUG] descriptionElement =', descriptionElement);
        console.log('🔍 [DEBUG] descriptionElement.innerHTML до =', descriptionElement?.innerHTML);
        
        if (descriptionElement) {
            const username = currentUser?.user_metadata?.username || currentUser?.email?.split('@')[0] || 'Пользователь';
            console.log('🔍 [DEBUG] username =', username);
            descriptionElement.innerHTML = `${username}, выберите желаемый статус. После оформления заказа администратор свяжется с вами для подтверждения и оплаты.`;
            console.log('🔍 [DEBUG] descriptionElement.innerHTML после =', descriptionElement.innerHTML);
        } else {
            console.log('🔍 [DEBUG] descriptionElement НЕ найден!');
        }
        
        modal.style.display = 'block';
        await loadVipPlansForShop(); // Загружаем VIP-планы в магазин
    }
}

/**
 * Скрывает модальное окно магазина.
 */
function hideShopModal() {
    const modal = document.getElementById('shopModal');
    // Останавливаем таймер, когда модальное окно закрывается
    stopVipCountdowns();
    if (modal) {
        modal.style.display = 'none';

        // Останавливаем таймер, когда модальное окно закрывается
        if (shopVipCountdownInterval) {
            clearInterval(shopVipCountdownInterval);
            shopVipCountdownInterval = null;
        }
    }
}

/**
 * Форматирует оставшееся время в читаемый вид (дни, часы, минуты).
 * @param {number} ms - Оставшееся время в миллисекундах.
 * @returns {string} - Отформатированная строка.
 */
function formatRemainingTime(ms) {
    if (ms <= 0) return 'Истек';

    // Если время больше 10 лет, считаем это бессрочным VIP
    const tenYearsInMs = 10 * 365 * 24 * 60 * 60 * 1000;
    if (ms > tenYearsInMs) {
        return 'Бессрочно';
    }

    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / (24 * 60 * 60));
    const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
    
    // Используем тот же формат как в vip-order-blocker-fixed.js
    if (days > 0) {
        return `${days}д ${hours}ч ${minutes}м`;
    } else if (hours > 0) {
        return `${hours}ч ${minutes}м`;
    } else {
        return `${minutes}м`;
    }
}

let vipCountdownIntervalId = null;

/**
 * Запускает интервал для обновления всех таймеров обратного отсчета VIP.
 */
function startVipCountdowns() {
    // Сначала останавливаем предыдущий интервал, чтобы избежать дублирования
    stopVipCountdowns();

    vipCountdownIntervalId = setInterval(() => {
        const countdownElements = document.querySelectorAll('.vip-countdown');
        if (countdownElements.length === 0) {
            stopVipCountdowns(); // Останавливаем, если на странице нет таймеров
            return;
        }

        countdownElements.forEach(element => {
            const expiresAt = element.getAttribute('data-expires-at');
            if (expiresAt) {
                // Используем Date.now() для консистентности
                const remainingMs = new Date(expiresAt).getTime() - Date.now();
                if (remainingMs > 0) {
                    element.innerHTML = `💎 VIP (${formatRemainingTime(remainingMs)})`;
                } else {
                    element.innerHTML = `<span style="color: #8892b0;">VIP Истек</span>`;
                    element.classList.remove('vip-countdown'); // Убираем класс, чтобы больше не обновлять
                }
            }
        });
    }, 1000); // Обновляем каждую секунду
    // console.log('⏰ VIP таймеры запущены.');
}

/**
 * Останавливает интервал обновления таймеров VIP.
 */
function stopVipCountdowns() {
    if (vipCountdownIntervalId) {
        clearInterval(vipCountdownIntervalId);
        vipCountdownIntervalId = null;
        // console.log('🛑 VIP таймеры остановлены.');
    }
}

/**
 * Запускает таймер обратного отсчета VIP в модальном окне магазина.
 * @param {string} expirationDateISO - Дата окончания VIP в формате ISO.
 */
function startShopVipTimer(expirationDateISO) {
    // Останавливаем предыдущий таймер, если он был
    if (shopVipCountdownInterval) {
        clearInterval(shopVipCountdownInterval);
    }

    const expirationDate = new Date(expirationDateISO);

    shopVipCountdownInterval = setInterval(() => {
        const timerElement = document.getElementById('vip-timer-display');
        if (!timerElement) {
            clearInterval(shopVipCountdownInterval);
            shopVipCountdownInterval = null;
            return;
        }

        const now = Date.now();
        const timeLeft = expirationDate.getTime() - now;

        if (timeLeft > 0) {
            const timeString = formatRemainingTime(timeLeft);
            if (timerElement) {
                timerElement.textContent = `ИСТЕКАЕТ ЧЕРЕЗ ${timeString}`;
            }
        } else {
            timerElement.textContent = 'VIP СТАТУС ИСТЕК';
            clearInterval(shopVipCountdownInterval);
            shopVipCountdownInterval = null;
        }
    }, 60000); // Обновляем раз в минуту (60000 мс)
}

// Загружает и отображает товары из базы данных
async function loadVipPlansForShop() {
    const container = document.getElementById('shop-products-container');
    if (!container) return;

    container.innerHTML = '<p style="color: #8892b0;">Загрузка VIP-планов...</p>';

    // ⭐️ НОВАЯ ПРОВЕРКА: Есть ли у пользователя уже активный заказ?
    // console.log('🔍 [DEBUG] Проверяем активные заказы...');
    
    // Получаем текущего пользователя
    const { data: { session }, error: sessionError } = await window.supabase.auth.getSession();
    const currentUser = session?.user;
    
    if (!sessionError && currentUser && currentUser.id) {
        const { data: activeOrders, error: activeError } = await window.supabase
            .from('orders')
            .select('*')
            .eq('user_id', currentUser.id)
            .in('status', ['pending', 'processing'])
            .order('created_at', { ascending: false })
            .limit(1);

        if (!activeError && activeOrders && activeOrders.length > 0) {
            const activeOrder = activeOrders[0];
            
            // Получаем информацию о продукте
            const { data: product } = await window.supabase
                .from('products')
                .select('*')
                .eq('id', activeOrder.product_id)
                .single();

            if (product) {
                // Форматируем срок действия для наглядности (duration_days теперь хранит минуты)
                let durationText = '';
                if (product.duration_days) {
                    if (product.duration_days >= 30.42 * 24 * 60) durationText = `${Math.floor(product.duration_days / (30.42 * 24 * 60))} год`;
                    else if (product.duration_days >= 30 * 24 * 60) durationText = `${Math.floor(product.duration_days / (30 * 24 * 60))} мес.`;
                    else if (product.duration_days >= 24 * 60) durationText = `${Math.floor(product.duration_days / (24 * 60))} дн.`;
                    else if (product.duration_days >= 60) durationText = `${Math.floor(product.duration_days / 60)} час`;
                    else durationText = `${product.duration_days} мин.`;
                } else {
                    durationText = 'Навсегда';
                }

                container.innerHTML = `
                    <div class="shop-product-card" style="background: linear-gradient(135deg, #1e3c72, #2a5298); border-color: #4fc3f7;">
                        <h4 style="color: #4fc3f7; margin-top: 0;">⏳ Ваш заказ в обработке!</h4>
                        <p style="color: #ccd6f6; font-size: 0.9rem;">Вы заказали: <strong style="color: #fff;">${product.name}</strong></p>
                        <div style="background: rgba(79, 195, 247, 0.1); border-radius: 5px; padding: 8px; margin: 10px 0; text-align: center; border: 1px solid rgba(79, 195, 247, 0.2);">
                            <span style="color: #4fc3f7; font-weight: bold; font-size: 1.1rem;">Срок: ${durationText}</span>
                        </div>
                        <div class="product-price" style="margin-bottom: 15px;">
                            <span class="current-price" style="font-size: 1.4rem;">${activeOrder.total_amount} руб.</span>
                        </div>
                        <p style="color: #8892b0; font-size: 0.8rem; margin-top: 15px;">Пожалуйста, ожидайте, администратор скоро с вами свяжется для подтверждения оплаты.</p>
                    </div>
                `;
                // console.log('🛒 VIP товары скрыты, так как у пользователя есть активный заказ в обработке.');
                return; // Прерываем дальнейшую загрузку товаров
            }
        }
    }
    // ⭐️ КОНЕЦ НОВОЙ ПРОВЕРКИ

    // ✅ ИСПРАВЛЕНИЕ: Принудительно получаем актуальную сессию пользователя,
    // чтобы избежать ситуации, когда currentUser еще не успел установиться.
    if (!currentUser) {
        const { data: { session }, error: sessionError } = await window.supabase.auth.getSession();
        currentUser = session?.user;

        if (sessionError) {
            console.error('❌ Ошибка получения сессии в магазине:', sessionError);
            container.innerHTML = '<p style="color: #f44336;">Ошибка загрузки сессии. Попробуйте перезагрузить страницу.</p>';
            return;
        }
    }

    if (currentUser && currentUser.id) {
        const profile = await authManager.getUserRole();
        const adminRoles = ['owner', 'admin_senior', 'admin', 'moderator_senior', 'moderator'];

        if (profile && (profile.isOwner || adminRoles.includes(profile.role))) {
            container.innerHTML = `
                <div class="vip-status-active" style="background: linear-gradient(135deg, #ffd700, #ff8c00); color: white; padding: 20px; border-radius: 10px; text-align: center;">
                    <h4 style="margin: 0 0 10px 0;">👑 VIP-статус по должности</h4>
                    <p style="margin: 0; font-size: 0.9rem;">Вам не нужно покупать VIP, так как он предоставлен вам по вашей роли (${getRoleName(profile.role)}).</p>
                </div>
            `;
            // console.log('🛒 VIP товары скрыты, так как у пользователя есть VIP по должности.');
            return;
        }

        // 🔒 ПРОВЕРКА АКТИВНОГО VIP СТАТУСА
        const { data: vipInfo, error: vipError } = await supabase
            .from('profiles')
            .select('is_vip, vip_expires_at')
            .eq('id', currentUser.id)
            .single();

        if (!vipError && vipInfo && vipInfo.is_vip) {
            const expirationDate = vipInfo.vip_expires_at ? new Date(vipInfo.vip_expires_at) : null;

            // Проверяем, активен ли VIP (бессрочный или дата окончания в будущем)
            if (!expirationDate || expirationDate > new Date()) {
                // Используем Date.now() для консистентности
                const timeLeftText = `ИСТЕКАЕТ ЧЕРЕЗ ${formatRemainingTime(expirationDate.getTime() - Date.now())}`;

                let statusIcon = '✅';
                let statusText = 'Ваш VIP статус активен!';

                container.innerHTML = `
                    <div class="vip-status-active" style="background: linear-gradient(135deg, #4caf50, #66bb6a); color: white; padding: 20px; border-radius: 10px; text-align: center;">
                        <h4 style="margin: 0 0 10px 0;">${statusIcon} ${statusText}</h4>
                        <p style="margin: 0; font-size: 1rem; font-weight: bold;">${timeLeftText.toUpperCase()}</p>
                    </div>
                `;
                // console.log('🛒 VIP товары скрыты, так как у пользователя уже есть активный VIP статус.');
                return;
            }
        }

        // ⭐️ КОНЕЦ НОВОЙ ПРОВЕРКИ
    }
    // КОНЕЦ ПРОВЕРКИ

    try {
        const { data: products, error } = await supabase
            .from('products')
            .select('*')
            .eq('category', 'vip') // Теперь загружаем ТОЛЬКО VIP-товары
            .eq('is_active', true)
            .order('price', { ascending: true });

        if (error) throw error;

        if (products.length === 0) {
            container.innerHTML = '<p style="color: #ff9800;">VIP-планы временно недоступны.</p>';
            return;
        }

        // 🔒 ФИЛЬТРАЦИЯ VIP ТОВАРОВ ДЛЯ ПОЛЬЗОВАТЕЛЕЙ С АКТИВНЫМ VIP СТАТУСОМ
        let filteredProducts = products;

        if (currentUser) {
            // Получаем VIP информацию пользователя
            const { data: vipInfo, error: vipError } = await supabase
                .from('profiles')
                .select('is_vip, vip_expires_at, role') // ИЗМЕНЕНИЕ: Запрашиваем и роль для полной проверки
                .eq('id', currentUser.id)
                .single();

            if (!vipError && vipInfo && vipInfo.is_vip) {
                // ИЗМЕНЕНИЕ: Проверяем, является ли VIP бессрочным (выданным админом)
                if (!vipInfo.vip_expires_at) {
                    container.innerHTML = `
                        <div class="vip-status-active" style="background: linear-gradient(135deg, #ffd700, #ff8c00); color: white; padding: 20px; border-radius: 10px; text-align: center;">
                            <h4 style="margin: 0 0 10px 0;">👑 У вас бессрочный VIP!</h4>
                            <p style="margin: 0; font-size: 0.9rem;">Вам не нужно покупать VIP, так как он был предоставлен вам администрацией сайта.</p>
                        </div>
                    `;
                    // console.log('🛒 VIP товары скрыты для пользователя с бессрочным VIP статусом в модальном окне');
                    return;
                }

                const now = new Date();
                const expirationDate = new Date(vipInfo.vip_expires_at);

                if (expirationDate > now) {
                    // Пользователь имеет активный VIP - рассчитываем оставшееся время
                    const timeLeft = expirationDate - now;
                    const totalSeconds = Math.floor(timeLeft / 1000);
                    const daysLeft = Math.floor(totalSeconds / (24 * 60 * 60));
                    const hoursLeft = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60));
                    const minutesLeft = Math.floor((totalSeconds % (60 * 60)) / 60);                    

                    // Определяем цвет фона в зависимости от оставшегося времени и убираем секунды
                    let backgroundGradient;
                    let timeLeftText = '';

                    if (daysLeft > 30) {
                        backgroundGradient = 'linear-gradient(135deg, #4caf50, #66bb6a)'; // Зеленый - много времени
                        timeLeftText = `истекает через ${daysLeft} дн. ${hoursLeft} ч. ${minutesLeft} мин.`;
                    } else if (daysLeft > 14) {
                        backgroundGradient = 'linear-gradient(135deg, #8bc34a, #9ccc65)'; // Светло-зеленый
                        timeLeftText = `истекает через ${daysLeft} дн. ${hoursLeft} ч. ${minutesLeft} мин.`;
                    } else if (daysLeft > 7) {
                        backgroundGradient = 'linear-gradient(135deg, #ff9800, #ffb74d)'; // Оранжевый
                        timeLeftText = `истекает через ${daysLeft} дн. ${hoursLeft} ч. ${minutesLeft} мин.`;
                    } else if (daysLeft > 3) {
                        backgroundGradient = 'linear-gradient(135deg, #ff5722, #ff7043)'; // Красный
                        timeLeftText = `истекает через ${daysLeft} дн. ${hoursLeft} ч. ${minutesLeft} мин.`;
                    } else if (daysLeft > 1) {
                        backgroundGradient = 'linear-gradient(135deg, #f44336, #ef5350)'; // Темно-красный
                        timeLeftText = `истекает через ${daysLeft} дн. ${hoursLeft} ч. ${minutesLeft} мин.`;
                    } else if (daysLeft === 1) {
                        backgroundGradient = 'linear-gradient(135deg, #e53935, #e57373)'; // Критично-красный
                        timeLeftText = `истекает через 1 дн. ${hoursLeft} ч. ${minutesLeft} мин.`;
                    } else if (daysLeft === 0 && hoursLeft > 0) {
                        backgroundGradient = 'linear-gradient(135deg, #d32f2f, #f44336)'; // Очень критично
                        timeLeftText = `истекает через ${hoursLeft} ч. ${minutesLeft} мин.`;
                    } else {
                        backgroundGradient = 'linear-gradient(135deg, #b71c1c, #d32f2f)'; // СРОЧНО ИСТЕКАЕТ
                        timeLeftText = 'Истек';
                    }

                    // Пользователь имеет активный VIP - скрываем все VIP товары
                    let statusIcon = '✅';
                    let statusText = 'Ваш VIP статус активен!';
                    if (typeof daysLeft !== 'undefined' && daysLeft <= 1) {
                        statusIcon = '⚠️';
                        statusText = 'Ваш VIP статус истекает!';
                    }

                    container.innerHTML = `
                        <div class="vip-status-active" style="background: ${backgroundGradient}; color: white; padding: 20px; border-radius: 10px; text-align: center;">
                            <h4 style="margin: 0 0 10px 0;">${statusIcon} ${statusText}</h4>
                            <p style="margin: 10px 0 0 0; font-size: 0.8rem; opacity: 0.8;">Истекает: ${expirationDate.toLocaleString('ru-RU', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            })}</p>
                        </div>
                    `;
                
                updateShopTimer(); // Первый вызов для немедленного отображения
                shopVipCountdownInterval = setInterval(updateShopTimer, 1000);

                // console.log('🛒 VIP товары скрыты, так как у пользователя уже есть активный VIP статус. Запущен таймер.');
                    return;
                }
            }
        }

        // Показываем VIP товары только если у пользователя нет активного VIP
        container.innerHTML = filteredProducts.map(product => {
            let buttonText = '🛒 Заказать';
            if (product.duration_days) {
                if (product.duration_days >= 30.42 * 24 * 60) {
                    buttonText += ` на ${Math.floor(product.duration_days / (30.42 * 24 * 60))} мес.`;
                } else if (product.duration_days >= 24 * 60) {
                    buttonText += ` на ${Math.floor(product.duration_days / (24 * 60))} дн.`;
                } else if (product.duration_days >= 60) {
                    buttonText += ` на ${Math.floor(product.duration_days / 60)} час`;
                } else {
                    buttonText += ` на ${product.duration_days} мин.`;
                }
            }
            
            return `
                <div class="shop-product-card">
                    <h4 style="color: #ffd700; margin-top: 0;">${product.name}</h4>
                    <p style="color: #ccd6f6; font-size: 0.9rem;">${product.description}</p>
                    <div class="product-price">
                        <span class="current-price">${product.price} руб.</span>
                        ${product.old_price ? `<span class="old-price">${product.old_price} руб.</span>` : ''}
                    </div>
                    <button class="hacker-btn" style="background: #4CAF50;" onclick="checkAndCreateVipOrder('${product.id}', '${product.name}', ${product.price})">
                        ${buttonText}
                    </button>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('❌ Ошибка загрузки товаров:', error);
        container.innerHTML = `<p style="color: #f44336;">Ошибка загрузки VIP-планов: ${error.message}</p>`;
    }
}

// Создает заказ на VIP-статус и делает функцию глобально доступной
window.createVipOrder = async function(productId, productName, price) {
    // console.log('🛍️ createVipOrder вызван с параметрами:', { productId, productName, price });
    
    // 🔒 ПРЯМАЯ ПРОВЕРКА АКТИВНЫХ ЗАКАЗОВ ЗДЕСЬ!
    try {
        // Получаем текущего пользователя
        const currentUser = window.authManager?.getCurrentUser() || window.supabase.auth.currentUser;
        if (!currentUser) {
            showNotification('❌ Для оформления заказа необходимо войти в систему.', 'error');
            return;
        }

        // console.log('🔍 Проверяем активные заказы для пользователя:', currentUser.id);
        
        // Проверяем ВСЕ возможные статусы активных заказов
        const { count: pendingOrdersCount, error: countError } = await window.supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', currentUser.id)
            .in('status', ['pending', 'processing', 'completed']);

        // console.log('🔍 Результат проверки заказов:', { count: pendingOrdersCount, error: countError });

        if (countError) {
            console.error('❌ Ошибка проверки активных заказов:', countError);
            showNotification('❌ Ошибка проверки заказов. Попробуйте позже.', 'error');
            return;
        }

        // Также проверяем есть ли вообще любые заказы за последние 24 часа
        const { count: recentOrdersCount } = await window.supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', currentUser.id)
            .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

        // console.log('🔍 Проверка заказов за 24 часа:', { count: recentOrdersCount });

        if (pendingOrdersCount && pendingOrdersCount > 0) {
            // console.log('⚠️ Найден активный заказ, блокируем повторное оформление');
            
            showNotification('⚠️ У вас уже есть заказ в обработке. Дождитесь ответа администратора.', 'warning');
            
            setTimeout(() => {
                alert('⚠️ У вас уже есть активный заказ!\n\nАдминистратор свяжется с вами в ближайшее время.\nДождитесь обработки текущего заказа.');
            }, 100);
            
            if (typeof hideShopModal === 'function') hideShopModal();
            return;
        }

        // Если есть заказы за последние 24 часа, тоже блокируем
        if (recentOrdersCount && recentOrdersCount > 0) {
            // console.log('⚠️ Найден недавний заказ, блокируем повторное оформление');
            
            showNotification('⚠️ Вы уже оформляли заказ сегодня. Дождитесь обработки предыдущего заказа.', 'warning');
            
            setTimeout(() => {
                alert('⚠️ Вы уже оформляли заказ сегодня!\n\nДождитесь обработки предыдущего заказа перед созданием нового.');
            }, 100);
            
            if (typeof hideShopModal === 'function') hideShopModal();
            return;
        }

        console.log('✅ Активных заказов нет, продолжаем оформление');

    } catch (error) {
        console.error('❌ Ошибка при проверке заказов:', error);
        showNotification('❌ Ошибка при проверке заказов. Попробуйте позже.', 'error');
        return;
    }
    
    // Если проверки пройдены, вызываем оригинальную функцию
    if (window.shopManager && typeof window.shopManager.createOrder === 'function') {
        await window.shopManager.createOrder(productId, productName, price);
    } else {
        console.error('❌ shopManager или метод createOrder не найдены!');
        showNotification('❌ Ошибка: Модуль магазина не загружен.', 'error');
    }

    console.log('🛍️ createVipOrder завершен');
};

// НОВАЯ функция с проверкой - вызывается из HTML кнопок
window.checkAndCreateVipOrder = async function(productId, productName, price) {
    console.log('🔒 checkAndCreateVipOrder вызван с параметрами:', { productId, productName, price });
    
    // СРАЗУ БЛОКИРУЕМ ПРОВЕРКОЙ
    try {
        // Получаем текущего пользователя
        const currentUser = window.authManager?.getCurrentUser() || window.supabase.auth.currentUser;
        if (!currentUser) {
            alert('❌ Для оформления заказа необходимо войти в систему.');
            return;
        }

        console.log('🔍 [DIRECT] Проверяем активные заказы для пользователя:', currentUser.id);
        
        // Проверяем ВСЕ возможные статусы активных заказов
        const { count: pendingOrdersCount, error: countError } = await window.supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', currentUser.id)
            .in('status', ['pending', 'processing', 'completed']);

        console.log('🔍 [DIRECT] Результат проверки заказов:', { count: pendingOrdersCount, error: countError });

        if (countError) {
            console.error('❌ Ошибка проверки активных заказов:', countError);
            alert('❌ Ошибка проверки заказов. Попробуйте позже.');
            return;
        }

        // Также проверяем есть ли вообще любые заказы за последние 24 часа
        const { count: recentOrdersCount } = await window.supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', currentUser.id)
            .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

        console.log('🔍 [DIRECT] Проверка заказов за 24 часа:', { count: recentOrdersCount });

        if (pendingOrdersCount && pendingOrdersCount > 0) {
            console.log('⚠️ [DIRECT] Найден активный заказ, блокируем повторное оформление');
            
            alert('⚠️ У вас уже есть активный заказ!\n\nАдминистратор свяжется с вами в ближайшее время.\nДождитесь обработки текущего заказа.');
            return;
        }

        // Если есть заказы за последние 24 часа, тоже блокируем
        if (recentOrdersCount && recentOrdersCount > 0) {
            console.log('⚠️ [DIRECT] Найден недавний заказ, блокируем повторное оформление');
            
            alert('⚠️ Вы уже оформляли заказ сегодня!\n\nДождитесь обработки предыдущего заказа перед созданием нового.');
            return;
        }

        console.log('✅ [DIRECT] Активных заказов нет, продолжаем оформление');

    } catch (error) {
        console.error('❌ Ошибка при проверке заказов:', error);
        alert('❌ Ошибка при проверке заказов. Попробуйте позже.');
        return;
    }
    
    // Если проверки пройдены, вызываем оригинальную функцию
    if (window.shopManager && typeof window.shopManager.createOrder === 'function') {
        await window.shopManager.createOrder(productId, productName, price);
    } else {
        console.error('❌ shopManager или метод createOrder не найдены!');
        alert('❌ Ошибка: Модуль магазина не загружен.');
    }

    console.log('🛍️ checkAndCreateVipOrder завершен');
};

/**
 * Показывает модальное окно для обратной связи.
 */
function showFeedbackModal() {
    try {
        // Проверяем, доступна ли функция getCurrentUser
        if (typeof getCurrentUser !== 'function') {
            console.warn('⚠️ Функция getCurrentUser не доступна, показываем форму для неавторизованных пользователей');
            showFeedbackFormOnly();
            return;
        }

        // Если пользователь не авторизован, показываем только форму отправки
        const currentUser = getCurrentUser();
        if (!currentUser) {
            showFeedbackFormOnly();
            return;
        }

        const existingModal = document.querySelector('.feedback-modal');
        if (existingModal) {
            existingModal.remove();
        }

    // Для авторизованных пользователей показываем окно с вкладками
    const modal = document.createElement('div');
    modal.className = 'auth-modal feedback-modal';
    modal.style.display = 'block';

    const emailInputHtml = !currentUser ? `<div class="form-group">
               <label for="feedbackEmail">Ваш Email для ответа:</label>
               <input type="email" id="feedbackEmail" required>
           </div>`
        : '';

    modal.innerHTML = `
        <div class="auth-content" style="max-width: 600px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="color: #00ccff; margin: 0;">✉️ Обратная связь</h3>
                <button onclick="this.closest('.auth-modal').remove()" class="hacker-btn" style="background: #f44336;">&times;</button>
            </div>

            <!-- Вкладки -->
            <div class="auth-tabs" style="margin-bottom: 20px;">
                <button class="auth-tab active" onclick="switchFeedbackTab(this, 'new-ticket')">Новое обращение</button>
                <button class="auth-tab" onclick="switchFeedbackTab(this, 'my-tickets'); loadMyFeedback();">Мои обращения</button>
            </div>

            <!-- Панели -->
            <div id="new-ticket" class="auth-panel active">
                <p style="color: #ccd6f6; text-align: center; margin-bottom: 25px; font-size: 14px;">
                    Есть вопрос или предложение? Напишите нам, и администрация ответит в ближайшее время.
                </p>
                <form id="feedbackForm" onsubmit="handleFeedbackSubmit(event)">
                    ${emailInputHtml}
                    <div class="form-group">
                        <label for="feedbackSubject">Тема сообщения:</label>
                        <input type="text" id="feedbackSubject" required>
                    </div>
                    <div class="form-group">
                        <label for="feedbackMessage">Ваше сообщение:</label>
                        <textarea id="feedbackMessage" rows="5" required></textarea>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">Отправить</button>
                    </div>
                </form>
            </div>

            <div id="my-tickets" class="auth-panel" style="display: none;">
                <div id="my-feedback-list" style="max-height: 400px; overflow-y: auto; padding-right: 10px;">
                    <p style="color: #8892b0;">Загрузка ваших обращений...</p>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    } catch (error) {
        console.error('❌ Ошибка при открытии модального окна обратной связи:', error);
        showNotification(`❌ Ошибка: ${error.message}`, 'error');
        showFeedbackFormOnly(); // В случае ошибки показываем простую форму
    }
}

/**
 * Переключает вкладки в модальном окне обратной связи.
 */
function switchFeedbackTab(button, tabId) {
    // Снимаем активность со всех вкладок
    button.parentElement.querySelectorAll('.auth-tab').forEach(tab => tab.classList.remove('active'));
    // Делаем активной нажатую
    button.classList.add('active');

    // Скрываем все панели
    const content = button.closest('.auth-content');
    content.querySelectorAll('.auth-panel').forEach(panel => panel.style.display = 'none');
    // Показываем нужную
    content.querySelector(`#${tabId}`).style.display = 'block';
}

/**
 * Показывает модальное окно только с формой отправки для неавторизованных пользователей.
 */
function showFeedbackFormOnly() {
    const existingModal = document.querySelector('.feedback-modal');
    if (existingModal) {
        existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.className = 'auth-modal feedback-modal';
    modal.style.display = 'block';

    const currentUser = getCurrentUser();
    const emailInputHtml = !currentUser ? `<div class="form-group">
               <label for="feedbackEmail">Ваш Email для ответа:</label>
               <input type="email" id="feedbackEmail" required>
           </div>`
        : '';

    modal.innerHTML = `
        <div class="auth-content" style="max-width: 600px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="color: #00ccff; margin: 0;">✉️ Обратная связь</h3>
                <button onclick="this.closest('.auth-modal').remove()" class="hacker-btn" style="background: #f44336;">&times;</button>
            </div>
            <p style="color: #ccd6f6; text-align: center; margin-bottom: 25px; font-size: 14px;">
                Есть вопрос или предложение? Напишите нам, и администрация ответит в ближайшее время.
            </p>
            <form id="feedbackForm" onsubmit="handleFeedbackSubmit(event)">
                ${emailInputHtml}
                <div class="form-group">
                    <label for="feedbackSubject">Тема сообщения:</label>
                    <input type="text" id="feedbackSubject" required>
                </div>
                <div class="form-group">
                    <label for="feedbackMessage">Ваше сообщение:</label>
                    <textarea id="feedbackMessage" rows="5" required></textarea>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">Отправить</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
}

/**
 * Загружает и отображает обращения текущего пользователя.
 */
async function loadMyFeedback() {
    const container = document.getElementById('my-feedback-list');
    if (!container) return;

    const currentUser = getCurrentUser();
    if (!currentUser) {
        container.innerHTML = '<p style="color: #f44336;">Для просмотра обращений необходимо войти в систему.</p>';
        return;
    }

    container.innerHTML = '<p style="color: #8892b0;">Загрузка ваших обращений...</p>';

    try {
        // Ищем сообщения по user_id ИЛИ по user_email (для связи незарегистрированных сообщений)
        const { data: messages, error } = await supabase
            .from('feedback')
            .select('*')
            .or(`user_id.eq.${currentUser.id},user_email.eq.${currentUser.email}`)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (messages.length === 0) {
            // Если не нашли по user_id и email, попробуем найти только по email (на случай если пользователь зарегистрировался после отправки сообщения)
            const { data: emailMessages, error: emailError } = await supabase
                .from('feedback')
                .select('*')
                .eq('user_email', currentUser.email)
                .is('user_id', null) // Только незарегистрированные сообщения
                .order('created_at', { ascending: false });

            if (emailError) throw emailError;

            if (emailMessages.length > 0) {
                // Связываем незарегистрированные сообщения с текущим пользователем
                console.log(`🔗 Найдено ${emailMessages.length} незарегистрированных сообщений для связи с пользователем`);

                // Обновляем сообщения чтобы связать их с пользователем
                for (const msg of emailMessages) {
                    await supabase
                        .from('feedback')
                        .update({ user_id: currentUser.id })
                        .eq('id', msg.id);

                    console.log(`✅ Связали сообщение "${msg.subject}" с пользователем`);
                }

                // Показываем связанные сообщения
                container.innerHTML = emailMessages.map(msg => {
                    const statusColors = { 'new': '#ff9800', 'read': '#2196F3', 'replied': '#4CAF50' };
                    const statusNames = { 'new': 'Новое', 'read': 'Прочитано', 'replied': 'Отвечено' };
                    const statusColor = statusColors[msg.status] || '#8892b0';
                    const statusName = statusNames[msg.status] || msg.status;

                    // Формируем бегущую строку для ответа
                    let responseHeader = '<strong style="color: #00ccff;">Ответ администрации:</strong>';
                    if (msg.response) {
                        responseHeader = `
                            <div class="marquee-container">
                                <div style="font-weight: bold; margin-bottom: 8px;"><span style="color: #ffd700; text-shadow: 0 0 5px #ffd700;">Ответ от: </span><span style="color: #00ccff; text-shadow: 0 0 5px #00ccff;">Администрация</span></div>
                            </div>
                        `;
                    }

                    return `
                        <details open style="background: rgba(0,255,65,0.05); padding: 15px; border-radius: 8px; border: 1px solid rgba(0,255,65,0.2); margin-bottom: 10px; cursor: pointer;">
                            <summary style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <strong style="color: #00ff41;">${msg.subject}</strong>
                                    <div style="font-size: 0.7rem; color: #8892b0; margin-top: 3px;">Отправлено без регистрации</div>
                                </div>
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <span style="font-size: 0.7rem; color: #8892b0;">${new Date(msg.created_at).toLocaleString('ru-RU')}</span>
                                    <span style="background: ${statusColor}; color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: bold;">${statusName}</span>
                                </div>
                            </summary>
                            <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid rgba(0,255,65,0.1);">
                                <div class="message-content" id="message-content-${msg.id}">
                                    <p style="color: #ccd6f6; white-space: pre-wrap; margin-bottom: 15px;"><strong>Ваше сообщение:</strong><br>${msg.message}</p>
                                </div>
                                ${msg.response ?
                                    `<div style="background: rgba(0,204,255,0.1); padding: 10px; border-radius: 5px; border-left: 3px solid #00ccff;">
                                            ${responseHeader}
                                            <p style="margin-top: 5px; color: #ccd6f6; white-space: pre-wrap;">${msg.response}</p>
                                        </div>`
                                    : '<p style="color: #8892b0; font-style: italic;">Ответа пока нет.</p>'
                                }
                            </div>
                        </details>
                    `;
                }).join('');

                showNotification(`✅ Найдено и связано ${emailMessages.length} обращений!`, 'success');
                return;
            }

            container.innerHTML = '<p style="color: #8892b0; text-align: center;">У вас пока нет обращений.</p>';
            return;
        }

        container.innerHTML = messages.map(msg => {
            const statusColors = { 'new': '#ff9800', 'read': '#2196F3', 'replied': '#4CAF50' };
            const statusNames = { 'new': 'Новое', 'read': 'Прочитано', 'replied': 'Отвечено' };
            const statusColor = statusColors[msg.status] || '#8892b0';
            const statusName = statusNames[msg.status] || msg.status;

            // Формируем бегущую строку для ответа
            let responseHeader = '<strong style="color: #00ccff;">Ответ администрации:</strong>';
            if (msg.response) { // Показываем бегущую строку, если есть ответ
                responseHeader = `
                    <div class="marquee-container">
                        <div style="font-weight: bold; margin-bottom: 8px;"><span style="color: #ffd700; text-shadow: 0 0 5px #ffd700;">Ответ от: </span><span style="color: #00ccff; text-shadow: 0 0 5px #00ccff;">Администрация</span></div>
                    </div>
                `;
            }

            // Проверяем права доступа для редактирования/удаления
            const currentUser = getCurrentUser();

            // АДМИНИСТРАЦИЯ И МОДЕРАТОРЫ могут редактировать/удалять сообщения пользователей
            const canEdit = currentUser && ['moderator', 'moderator_senior', 'admin', 'admin_senior', 'owner'].includes(currentUser.role);

            // Пользователи могут редактировать только свои сообщения (если они не администраторы или модераторы)
            const canEditOwn = currentUser && currentUser.id === msg.user_id && !['moderator', 'moderator_senior', 'admin', 'admin_senior', 'owner'].includes(currentUser.role);

            return `
                <details open style="background: rgba(0,255,65,0.05); padding: 15px; border-radius: 8px; border: 1px solid rgba(0,255,65,0.2); margin-bottom: 10px; cursor: pointer;">
                    <summary style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong style="color: #00ff41;">${msg.subject}</strong>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="font-size: 0.7rem; color: #8892b0;">${new Date(msg.created_at).toLocaleString('ru-RU')}</span>
                            <span style="background: ${statusColor}; color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: bold;">${statusName}</span>
                            ${canEdit ? `
                                <div style="display: flex; gap: 5px;">
                                    <button onclick="editFeedbackMessage('${msg.id}')" style="background: #2196F3; color: white; padding: 2px 8px; border: none; border-radius: 3px; font-size: 0.7rem; cursor: pointer;" title="Редактировать (только админы)">✏️</button>
                                    <button onclick="deleteFeedbackMessage('${msg.id}')" style="background: #f44336; color: white; padding: 2px 8px; border: none; border-radius: 3px; font-size: 0.7rem; cursor: pointer;" title="Удалить (только админы)">🗑️</button>
                                </div>
                            ` : ''}
                        </div>
                    </summary>
                    <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid rgba(0,255,65,0.1);">
                        <div class="message-content" id="message-content-${msg.id}">
                            <p style="color: #ccd6f6; white-space: pre-wrap; margin-bottom: 15px;"><strong>Ваше сообщение:</strong><br>${msg.message}</p>
                        </div>
                        ${msg.response ?
                            `<div style="background: rgba(0,204,255,0.1); padding: 10px; border-radius: 5px; border-left: 3px solid #00ccff;">
                                    ${responseHeader}
                                    <p style="margin-top: 5px; color: #ccd6f6; white-space: pre-wrap;">${msg.response}</p>
                                </div>`
                            : '<p style="color: #8892b0; font-style: italic;">Ответа пока нет.</p>'
                        }
                    </div>
                </details>
            `;
        }).join('');
    } catch (err) {
        container.innerHTML = `<p style="color: #f44336;">Ошибка загрузки обращений: ${err.message}</p>`;
    }
}

/**
 * Редактирует сообщение обратной связи.
 * @param {string} messageId - ID сообщения для редактирования.
 */
async function editFeedbackMessage(messageId) {
    try {
        // Получаем текущее сообщение
        const { data: message, error } = await supabase
            .from('feedback')
            .select('*')
            .eq('id', messageId)
            .single();

        if (error) throw error;

        // Проверяем права доступа
        const currentUser = getCurrentUser();
        const allowedRoles = ['moderator', 'moderator_senior', 'admin', 'admin_senior', 'owner'];
        if (!currentUser || (currentUser.id !== message.user_id && !allowedRoles.includes(currentUser.role))) {
            showNotification('❌ У вас нет прав для редактирования этого сообщения.', 'error');
            return;
        }

        // Создаем форму редактирования
        const editForm = document.createElement('div');
        editForm.style.cssText = `
            background: rgba(0,255,65,0.1);
            padding: 15px;
            border-radius: 8px;
            border: 1px solid rgba(0,255,65,0.3);
            margin-top: 10px;
        `;

        editForm.innerHTML = `
            <h4 style="color: #00ff41; margin-top: 0;">Редактирование сообщения</h4>
            <div style="margin-bottom: 10px;">
                <label style="color: #ccd6f6; display: block; margin-bottom: 5px;">Тема:</label>
                <input type="text" id="edit-subject" value="${message.subject}" style="width: 100%; padding: 8px; background: rgba(0,255,65,0.1); border: 1px solid rgba(0,255,65,0.3); color: #ccd6f6; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 15px;">
                <label style="color: #ccd6f6; display: block; margin-bottom: 5px;">Сообщение:</label>
                <textarea id="edit-message" rows="4" style="width: 100%; padding: 8px; background: rgba(0,255,65,0.1); border: 1px solid rgba(0,255,65,0.3); color: #ccd6f6; border-radius: 4px; resize: vertical;">${message.message}</textarea>
            </div>
            <div style="display: flex; gap: 10px;">
                <button onclick="saveFeedbackEdit('${messageId}')" style="background: #4CAF50; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer;">💾 Сохранить</button>
                <button onclick="cancelFeedbackEdit('${messageId}')" style="background: #f44336; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer;">❌ Отмена</button>
            </div>
        `;

        // Заменяем содержимое сообщения на форму редактирования
        const messageContent = document.getElementById(`message-content-${messageId}`);
        if (messageContent) {
            messageContent.innerHTML = editForm.outerHTML;
        }

    } catch (error) {
        console.error('❌ Ошибка при редактировании сообщения:', error);
        showNotification(`❌ Ошибка: ${error.message}`, 'error');
    }
}

/**
 * Инициализирует проверку сложности и совпадения паролей в форме регистрации.
 */
function initializePasswordChecks() {
    const registerPassword = document.getElementById('registerPassword');
    const registerPasswordConfirm = document.getElementById('registerPasswordConfirm');
    const passwordMatchError = document.getElementById('passwordMatch');
    const strengthFill = document.getElementById('strengthFill');
    const strengthText = document.getElementById('strengthText');

    if (!registerPassword || !registerPasswordConfirm) {
        console.warn('Элементы для проверки пароля не найдены.');
        return;
    }

    function checkPasswords() {
        if (!passwordMatchError) return;
        if (registerPassword.value && registerPasswordConfirm.value) {
            passwordMatchError.style.display = (registerPassword.value !== registerPasswordConfirm.value) ? 'block' : 'none';
        } else {
            passwordMatchError.style.display = 'none';
        }
    }

    function updatePasswordStrength() {
        if (!strengthFill || !strengthText) return;

        const password = registerPassword.value;
        let score = 0;
        if (password.length >= 8) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[a-z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^A-Za-z0-9]/.test(password)) score++;

        const strength = {
            0: { text: 'Очень слабый', color: '#e74c3c', width: '20%' }, 1: { text: 'Слабый', color: '#e74c3c', width: '20%' },
            2: { text: 'Слабый', color: '#f39c12', width: '40%' }, 3: { text: 'Средний', color: '#f1c40f', width: '60%' },
            4: { text: 'Надежный', color: '#2ecc71', width: '80%' }, 5: { text: 'Очень надежный', color: '#27ae60', width: '100%' }
        };

        const currentStrength = strength[score] || strength[0];
        strengthFill.style.width = currentStrength.width;
        strengthFill.style.backgroundColor = currentStrength.color;
        strengthText.textContent = currentStrength.text;
        strengthText.style.color = currentStrength.color;
    }

    registerPassword.addEventListener('input', updatePasswordStrength);
    registerPassword.addEventListener('input', checkPasswords);
    registerPasswordConfirm.addEventListener('input', checkPasswords);
}

// Экспортируем все функции в глобальную область видимости для доступа из HTML (ОБЪЕДИНЕННЫЙ БЛОК)
window.showNotification = showNotification;
window.showLoginModal = showLoginModal;
window.hideLoginModal = hideLoginModal;
window.showRegisterModal = showRegisterModal;
window.hideRegisterModal = hideRegisterModal;
window.showPasswordResetModal = showPasswordResetModal;
window.showRulesModal = showRulesModal;
window.showShopModal = showShopModal;
window.hideShopModal = hideShopModal;
window.showFeedbackModal = showFeedbackModal;
window.switchFeedbackTab = switchFeedbackTab;
window.editFeedbackMessage = editFeedbackMessage;
window.saveFeedbackEdit = saveFeedbackEdit;
window.cancelFeedbackEdit = cancelFeedbackEdit;
window.deleteFeedbackMessage = deleteFeedbackMessage;
window.handleFeedbackSubmit = handleFeedbackSubmit;
window.hidePasswordResetModal = hidePasswordResetModal; // Добавлено из предыдущего блока
window.showUploadModal = window.showUploadModal; // Добавляем новую функцию

/**
 * Сохраняет изменения в сообщении обратной связи.
 * @param {string} messageId - ID сообщения для сохранения.
 */
async function saveFeedbackEdit(messageId) {
    try {
        const newSubject = document.getElementById('edit-subject').value.trim();
        const newMessage = document.getElementById('edit-message').value.trim();

        if (!newSubject || !newMessage) {
            showNotification('❌ Заполните все поля.', 'error');
            return;
        }

        // Обновляем сообщение в базе данных
        const { error } = await supabase
            .from('feedback')
            .update({
                subject: newSubject,
                message: newMessage
            })
            .eq('id', messageId);

        if (error) throw error;

        showNotification('✅ Сообщение успешно обновлено!', 'success');

        // Перезагружаем список обращений
        loadMyFeedback();

    } catch (error) {
        console.error('❌ Ошибка при сохранении сообщения:', error);
        showNotification(`❌ Ошибка: ${error.message}`, 'error');
    }
}

/**
 * Отменяет редактирование сообщения.
 * @param {string} messageId - ID сообщения.
 */
async function cancelFeedbackEdit(messageId) {
    // Просто перезагружаем список обращений для отмены изменений
    loadMyFeedback();
}

/**
 * Удаляет сообщение обратной связи.
 * @param {string} messageId - ID сообщения для удаления.
 */
async function deleteFeedbackMessage(messageId) {
    // Подтверждение удаления
    if (!confirm('Вы уверены, что хотите удалить это сообщение?\nЭто действие нельзя отменить.')) {
        return;
    }

    try {
        // Получаем сообщение для проверки прав доступа
        const { data: message, error } = await supabase
            .from('feedback')
            .select('*')
            .eq('id', messageId)
            .single();

        if (error) throw error;

        // Проверяем права доступа
        const currentUser = getCurrentUser();
        const allowedRoles = ['moderator', 'moderator_senior', 'admin', 'admin_senior', 'owner'];
        if (!currentUser || (currentUser.id !== message.user_id && !allowedRoles.includes(currentUser.role))) {
            showNotification('❌ У вас нет прав для удаления этого сообщения.', 'error');
            return;
        }

        // Удаляем сообщение из базы данных
        const { error: deleteError } = await supabase
            .from('feedback')
            .delete()
            .eq('id', messageId);

        if (deleteError) throw deleteError;

        showNotification('✅ Сообщение успешно удалено!', 'success');

        // Перезагружаем список обращений
        loadMyFeedback();

    } catch (error) {
        console.error('❌ Ошибка при удалении сообщения:', error);
        showNotification(`❌ Ошибка: ${error.message}`, 'error');
    }
}

/**
 * Обрабатывает отправку формы обратной связи.
 * @param {Event} event - Событие отправки формы.
 */
async function handleFeedbackSubmit(event) {
    event.preventDefault();
    const subject = document.getElementById('feedbackSubject').value;
    const message = document.getElementById('feedbackMessage').value;
    const emailField = document.getElementById('feedbackEmail');
    const email = emailField ? emailField.value : null;

    const currentUser = getCurrentUser();

    if (!currentUser && !email) {
        showNotification('❌ Пожалуйста, укажите ваш email, чтобы мы могли вам ответить.', 'error');
        return;
    }

    try {
        const { error } = await window.supabase.from('feedback').insert({
            user_id: currentUser ? currentUser.id : null,
            user_email: currentUser ? currentUser.email : email,
            subject: subject,
            message: message,
            status: 'new'
        });

        if (error) throw error;

        showNotification('✅ Ваше сообщение успешно отправлено!', 'success');
        document.querySelector('.feedback-modal').remove();

    } catch (error) {
        console.error('❌ Ошибка отправки сообщения:', error);
        showNotification(`❌ Ошибка: ${error.message}`, 'error');
    }
}

/**
 * Показывает модальное окно загрузки мода
 */
window.showUploadModal = function() {
    // Проверяем авторизацию пользователя
    if (!window.authManager || !window.authManager.isAuthenticated()) {
        showNotification('❌ Для загрузки модов необходимо авторизоваться', 'error');
        if (typeof window.showLoginModal === 'function') {
            window.showLoginModal();
        }
        return;
    }
    
    // Проверяем VIP статус только для загрузки модов, не для выбора игр
    const user = window.authManager.getCurrentUser();
    if (!user || (!user.is_vip && user.role !== 'vip' && user.role !== 'admin' && user.role !== 'moderator')) {
        showNotification('❌ Для загрузки модов необходим VIP-статус', 'error');
        return;
    }
    
    // Показываем уведомление о временной недоступности
    showNotification('⚠️ Загрузка модов временно недоступна. Попробуйте позже.', 'info');
};