// БЛОКИРОВКА ПОВТОРНЫХ ЗАКАЗОВ VIP - ИСПРАВЛЕННАЯ ВЕРСИЯ

// Восстанавливаем отсутствующие функции из ui-modals.js
window.showShopModal = async function() {
    // Проверяем авторизацию пользователя
    const currentUser = window.authManager?.getCurrentUser() || window.supabase.auth.currentUser;
    if (!currentUser) {
        // Показываем модальное окно входа/регистрации (используем оригинальные функции)
        if (typeof window.showLoginModal === 'function') {
            window.showLoginModal();
        } else if (typeof window.showAuthModal === 'function') {
            window.showAuthModal();
        } else {
            ModalNotification.show('❌ Для оформления VIP-статуса необходимо войти в систему!\n\nПожалуйста, зарегистрируйтесь или войдите в аккаунт.', 'error');
        }
        return;
    }
    
    const modal = document.getElementById('shopModal');
    if (modal) {
        modal.style.display = 'block';
        await window.loadVipPlansForShop(); // Загружаем VIP-планы в магазин
    }
};

window.hideShopModal = function() {
    const modal = document.getElementById('shopModal');
    if (modal) {
        modal.style.display = 'none';
    }
};

// Простая функция уведомлений
window.showNotification = function(message, type = 'info') {
    // console.log(`[${type.toUpperCase()}] ${message}`);
};

// Функция перевода ролей
window.getRoleName = function(role) {
    const roleNames = {
        'owner': 'Владелец',
        'admin_senior': 'Главный администратор',
        'admin': 'Администратор',
        'moderator_senior': 'Главный модератор',
        'moderator': 'Модератор',
        'user': 'Пользователь',
        'vip': 'VIP-пользователь'
    };
    return roleNames[role] || role;
};

// Функция форматирования времени
window.formatRemainingTime = function(ms) {
    if (ms <= 0) return 'Истек';
    
    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / (24 * 60 * 60));
    const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
    const seconds = totalSeconds % 60;
    
    // Форматируем как в основном окне сайта с секундами
    if (days > 0) {
        return `${days}д ${hours}ч ${minutes}м ${seconds}с`;
    } else if (hours > 0) {
        return `${hours}ч ${minutes}м ${seconds}с`;
    } else {
        return `${minutes}м ${seconds}с`;
    }
};

// Загружает и отображает товары из базы данных
window.loadVipPlansForShop = async function() {
    const container = document.getElementById('shop-products-container');
    if (!container) return;

    container.innerHTML = '<p style="color: #8892b0;">Загрузка VIP-планов...</p>';

    try {
        // Получаем текущего пользователя
        const { data: { session }, error: sessionError } = await window.supabase.auth.getSession();
        const currentUser = session?.user;
        
        if (!sessionError && currentUser && currentUser.id) {
            // Получаем профиль пользователя для проверки VIP-статуса
            const { data: profile, error: profileError } = await window.supabase
                .from('profiles')
                .select('role, is_vip, vip_expires_at, vip_started_at')
                .eq('id', currentUser.id)
                .single();
            
            // ПРОВЕРКА: Если пользователь админ или владелец, показываем специальное сообщение
            if (!profileError && profile && (profile.is_owner || ['owner', 'admin_senior', 'admin', 'moderator_senior', 'moderator'].includes(profile.role))) {
                container.innerHTML = `
                    <div class="vip-status-active" style="background: linear-gradient(135deg, #ffd700, #ff8c00); color: white; padding: 20px; border-radius: 10px; text-align: center;">
                        <h4 style="margin: 0 0 10px 0;">👑 VIP-статус по должности</h4>
                        <p style="margin: 0; font-size: 0.9rem;">Вам не нужно покупать VIP, так как он предоставлен вам по вашей роли (${window.getRoleName(profile.role)}).</p>
                    </div>
                `;
                // console.log('🛒 VIP товары скрыты, так как у пользователя есть VIP по должности.');
                return true; // Есть VIP по должности
            }
            
            // ПРОВЕРКА АКТИВНЫХ ЗАКАЗОВ
            const { data: activeOrders, error: activeError } = await window.supabase
                .from('orders')
                .select('*')
                .eq('user_id', currentUser.id)
                .in('status', ['pending', 'completed'])  // ИСПРАВЛЕНИЕ: проверяем и pending и completed
                .order('created_at', { ascending: false })
                .limit(1);

            if (!activeError && activeOrders && activeOrders.length > 0) {
                const activeOrder = activeOrders[0];
                
                // Если заказ завершён, проверяем истёк ли VIP-статус
                if (activeOrder.status === 'completed' && profile && profile.vip_expires_at) {
                    const vipExpiresAt = new Date(profile.vip_expires_at);
                    const now = new Date();
                    
                    // Если VIP истёк, не показываем старый заказ, разрешаем купить новый
                    if (vipExpiresAt.getTime() <= now.getTime()) {
                        console.log('🕐 VIP-статус истёк, разрешаем покупу нового');
                        // Не возвращаем true, продолжаем загрузку товаров
                    } else {
                        // VIP ещё активен, показываем информацию о заказе
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

                            // Показываем сообщение о заказе
                            const vipExpiresAt = new Date(profile.vip_expires_at);
                            
                            let countdownHtml = '';
                            if (vipExpiresAt && vipExpiresAt > new Date()) {
                                // Используем точное время как в основном окне
                                const remainingMs = vipExpiresAt.getTime() - Date.now();
                                const totalSeconds = Math.floor(remainingMs / 1000);
                                const days = Math.floor(totalSeconds / 86400);
                                const hours = Math.floor((totalSeconds % 86400) / 3600);
                                const minutes = Math.floor((totalSeconds % 3600) / 60);
                                const seconds = totalSeconds % 60;
                                
                                let remainingTimeStr = '';
                                if (days > 0) {
                                    remainingTimeStr = `${days}д ${hours}ч ${minutes}м ${seconds}с`;
                                } else {
                                    remainingTimeStr = `${hours}ч ${minutes}м ${seconds}с`;
                                }
                                
                                // Получаем ник пользователя
                                const authUser = typeof authManager !== 'undefined' ? authManager.getCurrentUser() : null;
                                const username = authUser?.user_metadata?.username || authUser?.email?.split('@')[0] || currentUser?.email?.split('@')[0] || 'Пользователь';
                                
                                countdownHtml = `
                                    <div style="background: rgba(76, 175, 80, 0.1); border-radius: 5px; padding: 8px; margin: 10px 0; text-align: center; border: 1px solid rgba(76, 175, 80, 0.2);">
                                        <span style="color: #4CAF50; font-weight: bold; font-size: 0.9rem;">
                                            👤 ${username} | ⏰ VIP-статус активен еще: ${remainingTimeStr}
                                        </span>
                                    </div>
                                `;
                            }
                            
                            container.innerHTML = `
                                <div class="shop-product-card" style="background: linear-gradient(135deg, #1e3c72, #2a5298); border-color: #4fc3f7;">
                                    <h4 style="color: #4fc3f7; margin-top: 0;">✅ Завершен Ваш заказ!</h4>
                                    <p style="color: #ccd6f6; font-size: 0.9rem;">Вы заказали: <strong style="color: #fff;">${product.name}</strong></p>
                                    <div style="background: rgba(79, 195, 247, 0.1); border-radius: 5px; padding: 8px; margin: 10px 0; text-align: center; border: 1px solid rgba(79, 195, 247, 0.2);">
                                        <span style="color: #4fc3f7; font-weight: bold; font-size: 1.1rem;">Срок: ${durationText}</span>
                                    </div>
                                    <div class="product-price" style="margin-bottom: 15px;">
                                        <span class="current-price" style="font-size: 1.4rem;">${activeOrder.total_amount} руб.</span>
                                    </div>
                                    <p style="color: #8892b0; font-size: 0.8rem; margin-top: 15px;">
                                        Ваш заказ успешно обработан! VIP-статус активирован.
                                    </p>
                                    ${countdownHtml}
                                </div>
                            `;
                            
                            // Запускаем обновление обратного отсчета если VIP активен
                            if (vipExpiresAt && vipExpiresAt > new Date()) {
                                startVipCountdown(container, vipExpiresAt, product, durationText, activeOrder);
                            }
                            
                            return true; // Есть активный VIP
                        }
                    }
                } else if (activeOrder.status === 'pending') {
                    // Заказ в обработке - показываем информацию
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
                                <h4 style="color: #4fc3f7; margin-top: 0;">⏳ В обработке Ваш заказ!</h4>
                                <p style="color: #ccd6f6; font-size: 0.9rem;">Вы заказали: <strong style="color: #fff;">${product.name}</strong></p>
                                <div style="background: rgba(79, 195, 247, 0.1); border-radius: 5px; padding: 8px; margin: 10px 0; text-align: center; border: 1px solid rgba(79, 195, 247, 0.2);">
                                    <span style="color: #4fc3f7; font-weight: bold; font-size: 1.1rem;">Срок: ${durationText}</span>
                                </div>
                                <div class="product-price" style="margin-bottom: 15px;">
                                    <span class="current-price" style="font-size: 1.4rem;">${activeOrder.total_amount} руб.</span>
                                </div>
                                <p style="color: #8892b0; font-size: 0.8rem; margin-top: 15px;">
                                    Пожалуйста, ожидайте, администратор скоро с вами свяжется для подтверждения оплаты.
                                </p>
                            </div>
                        `;
                        
                        return true; // Есть заказ в обработке
                    }
                }
            }
        }

        // Загружаем VIP-товары только если нет активных заказов
        const { data: products, error } = await window.supabase
            .from('products')
            .select('*')
            .eq('category', 'vip')
            .eq('is_active', true)
            .order('price', { ascending: true });

        if (error) throw error;

        if (products.length === 0) {
            container.innerHTML = '<p style="color: #ff9800;">VIP-планы временно недоступны.</p>';
            return;
        }

        // Отображаем товары
        let productsHTML = '';
        products.forEach(product => {
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

            productsHTML += `
                <div class="shop-product-card">
                    <h4>${product.name}</h4>
                    <p>${product.description || 'VIP-доступ к эксклюзивным модам.'}</p>
                    <div class="product-duration">Срок: ${durationText}</div>
                    <div class="product-price">
                        ${product.old_price ? `<span class="old-price">${product.old_price} руб.</span>` : ''}
                        <span class="current-price">${product.price} руб.</span>
                    </div>
                    <button class="buy-button" onclick="window.checkAndCreateVipOrder('${product.id}', '${product.name}', ${product.price})">
                        🛒 Заказать на ${durationText}
                    </button>
                </div>
            `;
        });

        container.innerHTML = productsHTML;
        // console.log('✅ VIP-планы загружены и отображены');

    } catch (error) {
        console.error('❌ Ошибка загрузки VIP-планов:', error);
        container.innerHTML = '<p style="color: #f44336;">Ошибка загрузки. Попробуйте позже.</p>';
    }
};

// Блокировка повторных заказов при клике
window.checkAndCreateVipOrder = async function(productId, productName, price) {
    // console.log('🔒 checkAndCreateVipOrder вызван с параметрами:', { productId, productName, price });
    
    // Проверяем авторизацию
    const currentUser = window.authManager?.getCurrentUser() || window.supabase.auth.currentUser;
    if (!currentUser) {
        ModalNotification.show('❌ Для оформления заказа необходимо войти в систему!\n\nПожалуйста, зарегистрируйтесь или войдите в аккаунт.', 'error');
        return;
    }
    
    try {
        // Получаем профиль пользователя для проверки VIP-статуса
        const { data: profile, error: profileError } = await window.supabase
            .from('profiles')
            .select('is_vip, vip_expires_at')
            .eq('id', currentUser.id)
            .single();
        
        // Проверяем только pending заказы
        const { count: pendingOrdersCount, error: pendingError } = await window.supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', currentUser.id)
            .eq('status', 'pending');

        if (pendingError) {
            console.error('❌ Ошибка проверки заказов в обработке:', pendingError);
            ModalNotification.show('❌ Ошибка проверки заказов. Попробуйте позже.', 'error');
            return;
        }

        if (pendingOrdersCount && pendingOrdersCount > 0) {
            console.log('⚠️ Найден заказ в обработке, блокируем повторное оформление');
            ModalNotification.show('⚠️ У вас уже есть заказ в обработке!\n\nАдминистратор свяжется с вами в ближайшее время.\nДождитесь обработки текущего заказа.', 'warning');
            return;
        }

        // Проверяем завершённые заказы только если VIP истёк
        if (!profileError && profile && profile.is_vip && profile.vip_expires_at) {
            const vipExpiresAt = new Date(profile.vip_expires_at);
            const now = new Date();
            
            // Если VIP ещё активен, проверяем завершённые заказы
            if (vipExpiresAt.getTime() > now.getTime()) {
                const { count: completedOrdersCount, error: completedError } = await window.supabase
                    .from('orders')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', currentUser.id)
                    .eq('status', 'completed');

                if (!completedError && completedOrdersCount && completedOrdersCount > 0) {
                    console.log('⚠️ Найден активный VIP с завершённым заказом, блокируем повторное оформление');
                    ModalNotification.show('⚠️ У вас уже есть активный VIP-статус!\n\nДождитесь истечения текущего статуса для оформления нового заказа.', 'warning');
                    return;
                }
            }
        }

        // Создаем заказ
        const { data: order, error: orderError } = await window.supabase
            .from('orders')
            .insert({
                user_id: currentUser.id,
                product_id: productId,
                total_amount: price,
                status: 'pending'
            })
            .select()
            .single();

        if (orderError) {
            console.error('❌ Ошибка создания заказа:', orderError);
            ModalNotification.show('❌ Ошибка оформления заказа. Попробуйте позже.', 'error');
            return;
        }

        // console.log('✅ Заказ успешно создан:', order);
        ModalNotification.show('✅ Заказ успешно оформлен!\n\nАдминистратор свяжется с вами для подтверждения.', 'success');
        
        // Добавляем задержку чтобы уведомление было видно поверх магазина
        setTimeout(async () => {
            await window.loadVipPlansForShop();
        }, 1000); // Задержка 1 секунда

    } catch (error) {
        console.error('❌ Критическая ошибка при оформлении заказа:', error);
        ModalNotification.show('❌ Произошла ошибка. Попробуйте позже.', 'error');
    }
};

// Функция для обновления обратного отсчета VIP-статуса
function startVipCountdown(container, expiresAt, product, durationText, activeOrder) {
    // console.log('🛒 startVipCountdown вызвана с expiresAt:', expiresAt);
    
    const updateCountdown = () => {
        const now = Date.now(); // Используем Date.now() как в основном окне
        const remainingMs = expiresAt.getTime() - now;
        
        if (remainingMs <= 0) {
            // VIP истек, отключаем VIP-статус и перезагружаем страницу
            // console.log('⏰ VIP-статус истек! Отключаем VIP и перезагружаем страницу...');
            
            // Отключаем VIP-статус в базе данных
            const currentUser = window.supabase.auth.currentUser;
            if (currentUser) {
                window.supabase
                    .from('profiles')
                    .update({ 
                        is_vip: false, 
                        vip_expires_at: null,
                        vip_started_at: null
                    })
                    .eq('id', currentUser.id)
                    .then(() => {
                        // console.log('✅ VIP-статус отключен в базе данных');
                        // Перезагружаем страницу для обновления UI
                        window.location.reload();
                    })
                    .catch(error => {
                        console.error('❌ Ошибка при отключении VIP-статуса:', error);
                        window.location.reload();
                    });
            } else {
                window.location.reload();
            }
            return;
        }
        
        const remainingTimeStr = window.formatRemainingTime ? window.formatRemainingTime(remainingMs) : 'Истекает';
        
        // Получаем ник пользователя для обновления
        const currentUser = typeof authManager !== 'undefined' ? authManager.getCurrentUser() : null;
        const username = currentUser?.user_metadata?.username || currentUser?.email?.split('@')[0] || 'Пользователь';
        
        // Обновляем только блок с обратным отсчетом
        const countdownElement = container.querySelector('span[style*="VIP-статус активен еще"]');
        if (countdownElement) {
            countdownElement.innerHTML = `
                <span style="color: #4CAF50; font-weight: bold; font-size: 0.9rem;">
                    👤 ${username} | ⏰ VIP-статус активен еще: ${remainingTimeStr}
                </span>
            `;
            // console.log('🛒 Таймер магазина обновлен:', remainingTimeStr);
        } else {
            // Если элемент не найден, обновляем весь контейнер
            container.innerHTML = `
                <div class="shop-product-card" style="background: linear-gradient(135deg, #1e3c72, #2a5298); border-color: #4fc3f7;">
                    <h4 style="color: #4fc3f7; margin-top: 0;">✅ Завершен Ваш заказ!</h4>
                    <p style="color: #ccd6f6; font-size: 0.9rem;">Вы заказали: <strong style="color: #fff;">${product.name}</strong></p>
                    <div style="background: rgba(79, 195, 247, 0.1); border-radius: 5px; padding: 8px; margin: 10px 0; text-align: center; border: 1px solid rgba(79, 195, 247, 0.2);">
                        <span style="color: #4fc3f7; font-weight: bold; font-size: 1.1rem;">Срок: ${durationText}</span>
                    </div>
                    <div class="product-price" style="margin-bottom: 15px;">
                        <span class="current-price" style="font-size: 1.4rem;">${activeOrder.total_amount} руб.</span>
                    </div>
                    <p style="color: #8892b0; font-size: 0.8rem; margin-top: 15px;">
                        Ваш заказ успешно обработан! VIP-статус активирован.
                    </p>
                    <div style="background: rgba(76, 175, 80, 0.1); border-radius: 5px; padding: 8px; margin: 10px 0; text-align: center; border: 1px solid rgba(76, 175, 80, 0.2);">
                        <span style="color: #4CAF50; font-weight: bold; font-size: 0.9rem;">
                            👤 ${username} | ⏰ VIP-статус активен еще: ${remainingTimeStr}
                        </span>
                    </div>
                </div>
            `;
        }
        
        // Обновляем каждую секунду
        setTimeout(updateCountdown, 1000);
    };
    
    updateCountdown();
}

// console.log('✅ VIP-блокировщик заказов (исправленная версия) загружен');

// Глобальная проверка VIP-статуса при загрузке страницы
window.checkVipStatus = async function() {
    const currentUser = window.supabase.auth.currentUser;
    if (!currentUser) return;
    
    try {
        const { data: profile } = await window.supabase
            .from('profiles')
            .select('is_vip, vip_expires_at')
            .eq('id', currentUser.id)
            .single();
            
        if (profile && profile.is_vip && profile.vip_expires_at) {
            const expiresAt = new Date(profile.vip_expires_at);
            const now = Date.now(); // Используем Date.now() для консистентности
            
            if (expiresAt.getTime() <= now) {
                // VIP истек, отключаем его
                // console.log('⏰ VIP-статус истек при загрузке страницы! Отключаем...');
                await window.supabase
                    .from('profiles')
                    .update({ 
                        is_vip: false, 
                        vip_expires_at: null,
                        vip_started_at: null
                    })
                    .eq('id', currentUser.id);
                
                // console.log('✅ VIP-статус отключен, страница будет перезагружена');
                window.location.reload();
            } else {
                // console.log('✅ VIP-статус активен, время истечения:', expiresAt.toLocaleString('ru-RU'));
            }
        }
    } catch (error) {
        console.error('❌ Ошибка проверки VIP-статуса:', error);
    }
};

// Запускаем проверку при загрузке
setTimeout(() => {
    window.checkVipStatus();
}, 2000);
