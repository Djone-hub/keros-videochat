// Модуль системы магазина
// Управление товарами, заказами и платежами

class ShopManager {
    constructor() {
        this.products = [];
        this.cart = [];
        this.orders = [];
        this.currentUser = null;
        this.isLoading = false;
        this.userVipInfo = null;
        this.isProcessingOrder = false; // Флаг для предотвращения дублирования заказов
    }

    // Инициализация магазина
    async initialize() {
        try {
            // ✅ ИСПРАВЛЕНИЕ: Ждем инициализации authManager, если он еще не готов
            if (typeof authManager === 'undefined') {
                // console.log('⏳ Магазин ожидает инициализации authManager...');
                // Проверяем каждые 100ms, готов ли authManager
                let attempts = 0;
                const maxAttempts = 30; // 3 секунды максимум
                while (typeof authManager === 'undefined' && attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    attempts++;
                }
                
                if (typeof authManager === 'undefined') {
                    // console.error('❌ [КРИТИЧЕСКАЯ ОШИБКА] authManager не инициализирован за отведенное время. Магазин не может быть инициализирован.');
                    return; // Прерываем инициализацию
                }
                
                // console.log('✅ authManager готов, продолжаем инициализацию магазина');
            }

            this.currentUser = authManager.getCurrentUser();
            await this.loadUserVipInfo(); // Загружаем VIP информацию пользователя

            // ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА: Если пользователь зашел с активным VIP, показываем сообщение
            if (this.currentUser && this.userVipInfo) {
                const vipDaysLeft = this.getVipDaysLeft();
                if (vipDaysLeft > 5) {
                    const vipLevel = this.getVipLevel();
                    const statusText = this.getVipStatusText();
                    // console.log('👑 Пользователь с активным VIP статусом зашел в магазин - VIP товары будут скрыты');
                    // Показываем уведомление пользователю
                    setTimeout(() => {
                        this.showNotification(`👑 Ваш VIP💎${vipLevel} ${statusText}`, 'info');
                    }, 2000);
                }
            }

            await this.loadProducts();
            this.loadCart();
            this.setupEventListeners();
        } catch (error) {
            console.error('❌ Ошибка инициализации магазина:', error);
        }
    }

    // Загрузка товаров
    async loadProducts(category = 'all') {
        try {
            this.isLoading = true;

            let query = window.supabase
                .from('products')
                .select('*')
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (category !== 'all') {
                query = query.eq('category', category);
            }

            const { data: products, error } = await query;

            if (error) throw error;

            // ФИЛЬТРАЦИЯ VIP ТОВАРОВ ДЛЯ ПОЛЬЗОВАТЕЛЕЙ С АКТИВНЫМ VIP СТАТУСОМ
            let filteredProducts = products || [];

            if (this.currentUser && this.userVipInfo) {
                // Проверяем активный VIP статус (включая бесрочный)
                const hasActiveVip = this.hasActiveVipStatus();
                
                // Проверяем, есть ли VIP по должности (администраторы и владельцы)
                const hasVipByRole = this.userVipInfo.role && ['owner', 'admin_senior', 'admin', 'moderator_senior', 'moderator'].includes(this.userVipInfo.role);

                // Если у пользователя активный VIP или VIP по должности, скрываем VIP товары
                if (hasActiveVip || hasVipByRole) {
                    filteredProducts = filteredProducts.filter(product => product.category !== 'vip');
                    // console.log('🛒 VIP товары скрыты - у пользователя уже есть VIP статус');
                }
            }

            this.products = filteredProducts;
            this.renderProducts();

            this.isLoading = false;
        } catch (error) {
            console.error('Ошибка загрузки товаров:', error);
            this.isLoading = false;
        }
    }

    // Рендер товаров
    renderProducts() {
        const productsContainer = document.getElementById('shopProducts');
        if (!productsContainer) return;

        if (this.isLoading) {
            productsContainer.innerHTML = '<div class="loading">Загрузка товаров...</div>';
            return;
        }

        // ФИЛЬТРАЦИЯ В РЕНДЕРЕ: Дополнительная проверка для надежности
        let productsToRender = [...this.products];

        if (this.currentUser && this.userVipInfo) {
            // Проверяем активный VIP статус (включая бесрочный)
            const hasActiveVip = this.hasActiveVipStatus();
            
            // Проверяем, есть ли VIP по должности (администраторы и владельцы)
            const hasVipByRole = this.userVipInfo.role && ['owner', 'admin_senior', 'admin', 'moderator_senior', 'moderator'].includes(this.userVipInfo.role);

            // Если у пользователя активный VIP или VIP по должности, скрываем VIP товары
            if (hasActiveVip || hasVipByRole) {
                productsToRender = productsToRender.filter(product => product.category !== 'vip');
                // console.log('🛒 VIP товары скрыты в рендере - у пользователя уже есть VIP статус');
            }
        }

        if (productsToRender.length === 0) {
            // Проверяем, есть ли у пользователя VIP статус или VIP по должности
            const hasActiveVip = this.hasActiveVipStatus();
            const hasVipByRole = this.userVipInfo && this.userVipInfo.role && ['owner', 'admin_senior', 'admin', 'moderator_senior', 'moderator'].includes(this.userVipInfo.role);
            
            if (this.currentUser && this.userVipInfo && (hasActiveVip || hasVipByRole)) {
                // Показываем специальное сообщение для пользователей с VIP статусом
                productsContainer.innerHTML = `
                    <div class="vip-status-message" style="text-align: center; padding: 3rem; color: #ffd700;">
                        <h3 style="color: #ffd700; margin-bottom: 1rem;">💎 У вас уже есть VIP-статус!</h3>
                        <p style="color: #8892b0; margin-bottom: 1rem;">Ваш VIP-статус предоставлен по вашей должности (${this.getRoleDisplayName(this.userVipInfo.role)}).</p>
                        <p style="color: #8892b0;">Все привилегии VIP-доступа уже доступны вам навсегда.</p>
                        <div style="margin-top: 2rem;">
                            <button onclick="this.closest('.shop-modal').remove()" class="hacker-btn" style="background: #4CAF50; color: white; padding: 0.75rem 1.5rem; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">
                                ✅ Понятно
                            </button>
                        </div>
                    </div>
                `;
            } else {
                productsContainer.innerHTML = '<div class="no-products">Нет доступных товаров</div>';
            }
            return;
        }

        const html = productsToRender.map(product => this.renderProductCard(product)).join('');
        productsContainer.innerHTML = html;
    }

    // Рендер карточки товара
    renderProductCard(product) {
        const discount = product.old_price ? Math.round((1 - product.price / product.old_price) * 100) : 0;

        // Проверяем VIP статус пользователя для VIP товаров
        let vipStatusHtml = '';
        let buttonDisabled = product.stock_quantity <= 0;
        let buttonText = product.stock_quantity > 0 ? 'Добавить в корзину' : 'Нет в наличии';
        let buttonClass = 'btn btn-primary add-to-cart-btn';

        // ПРОВЕРКА РОЛИ: Если у пользователя есть права админа/модера, у него уже есть VIP
        const adminRoles = ['owner', 'admin_senior', 'admin', 'moderator_senior', 'moderator'];
        // ИЗМЕНЕНИЕ: Добавляем проверку флага is_owner для надежности
        if (this.userVipInfo && (this.userVipInfo.is_owner || adminRoles.includes(this.userVipInfo.role))) {
            vipStatusHtml = `
                <div class="vip-status-active" style="background: linear-gradient(135deg, #ffd700, #ff8c00); color: white; padding: 8px; border-radius: 5px; margin-bottom: 10px; text-align: center;">
                    👑 VIP-статус по должности
                </div>
            `;
            buttonDisabled = true;
            buttonText = 'VIP уже активен';
            buttonClass = 'btn btn-success add-to-cart-btn';
        } else if (this.userVipInfo && this.userVipInfo.is_vip && !this.userVipInfo.vip_expires_at) {
            // ИЗМЕНЕНИЕ: Добавляем проверку на бессрочный VIP (is_vip === true и vip_expires_at === null)
            vipStatusHtml = `
                <div class="vip-status-active" style="background: linear-gradient(135deg, #ffd700, #ff8c00); color: white; padding: 8px; border-radius: 5px; margin-bottom: 10px; text-align: center;">
                    👑 Бессрочный VIP от администрации
                </div>
            `;
            buttonDisabled = true;
            buttonText = 'VIP уже активен';
            buttonClass = 'btn btn-success add-to-cart-btn';
            
        } else 

        if (product.category === 'vip' && this.currentUser) {
            // Получаем актуальную информацию о VIP статусе пользователя
            const vipDaysLeft = this.getVipDaysLeft();

            if (vipDaysLeft > 5) {
                // VIP активен более 5 дней - показываем зеленым и блокируем покупку
                const vipLevel = this.getVipLevel();
                vipStatusHtml = `
                    <div class="vip-status-active" style="background: linear-gradient(135deg, #4caf50, #45a049); color: white; padding: 8px; border-radius: 5px; margin-bottom: 10px; text-align: center;">
                        ✅ VIP💎${vipLevel} активен
                    </div>
                `;
                buttonDisabled = true;
                buttonText = 'VIP уже активен';
                buttonClass = 'btn btn-success add-to-cart-btn';
            } else if (vipDaysLeft > 0 && vipDaysLeft <= 5) {
                // VIP истекает в течение 5 дней - показываем желтым, можно купить
                const vipLevel = this.getVipLevel();
                const statusText = this.getVipStatusText();
                vipStatusHtml = `
                    <div class="vip-status-warning" style="background: linear-gradient(135deg, #ff9800, #f57c00); color: white; padding: 8px; border-radius: 5px; margin-bottom: 10px; text-align: center;">
                        ⚠️ VIP💎${vipLevel} ${statusText}
                    </div>
                `;
            } else if (vipDaysLeft <= 0) {
                // VIP истек - показываем красным, можно купить
                vipStatusHtml = `
                    <div class="vip-status-expired" style="background: linear-gradient(135deg, #f44336, #d32f2f); color: white; padding: 8px; border-radius: 5px; margin-bottom: 10px; text-align: center;">
                        ❌ VIP💎${this.getVipLevel()} истек
                    </div>
                `;
            }
        }

        return `
            <div class="product-card ${product.category === 'vip' && this.currentUser ? 'vip-product' : ''}" data-product-id="${product.id}">
                <div class="product-image">
                    <img src="${product.image_url || '/images/no-image.png'}" alt="${product.name}" onerror="this.src='/images/no-image.png'">
                    ${discount > 0 ? `<span class="discount-badge">-${discount}%</span>` : ''}
                </div>
                <div class="product-info">
                    <h3 class="product-name">${product.name}</h3>
                    <p class="product-description">${product.description || ''}</p>
                    ${vipStatusHtml}
                    <div class="product-price">
                        <span class="current-price">${product.price} ₽</span>
                        ${product.old_price ? `<span class="old-price">${product.old_price} ₽</span>` : ''}
                    </div>
                    <div class="product-meta">
                        <span class="category">${product.category}</span>
                        <span class="stock ${product.stock_quantity > 0 ? 'in-stock' : 'out-of-stock'}">
                            ${product.stock_quantity > 0 ? `В наличии: ${product.stock_quantity}` : 'Нет в наличии'}
                        </span>
                    </div>
                    <button onclick="shopManager.addToCart('${product.id}')"
                            class="btn ${buttonClass}"
                            ${buttonDisabled ? 'disabled' : ''}>
                        ${buttonText}
                    </button>
                </div>
            </div>
        `;
    }

    // Добавление товара в корзину
    async addToCart(productId) {
        if (!this.currentUser) {
            this.showNotification('Необходимо войти в систему для добавления товаров в корзину', 'error');
            return;
        }

        // ПРОВЕРКА: Убеждаемся, что у пользователя нет других активных заказов
        const hasActiveOrders = await this.checkActiveOrders();
        if (hasActiveOrders) {
            this.showNotification('У вас уже есть активный заказ в обработке. Дождитесь ответа администратора.', 'warning');
            return;
        }

        const product = this.products.find(p => p.id === productId);
        if (!product) return;

        if (product.stock_quantity <= 0) {
            this.showNotification('Товар отсутствует в наличии', 'error');
            return;
        }

        // Проверяем VIP статус для VIP товаров
        if (product.category === 'vip') {
            // Проверяем активный VIP статус (включая бесрочный)
            const hasActiveVip = this.hasActiveVipStatus();
            
            // Проверяем, есть ли VIP по должности (администраторы и владельцы)
            const hasVipByRole = this.userVipInfo && this.userVipInfo.role && ['owner', 'admin_senior', 'admin', 'moderator_senior', 'moderator'].includes(this.userVipInfo.role);

            if (hasActiveVip || hasVipByRole) {
                return; // Не показывать сообщение для активных статусов
            } else {
                const statusText = this.getVipStatusText();
                if (!confirm(`Ваш VIP${this.getVipLevel()} ${statusText} Продлить подписку?`)) {
                    return;
                }
            }
        }

        try {
            // Проверяем, есть ли товар уже в корзине
            const existingItem = this.cart.find(item => item.product_id === productId);

            if (existingItem) {
                // Увеличиваем количество
                existingItem.quantity += 1;
            } else {
                // Добавляем новый товар в корзину
                const cartItem = {
                    id: Date.now().toString(),
                    product_id: productId,
                    product_name: product.name,
                    product_price: product.price,
                    product_image: product.image_url,
                    quantity: 1,
                    added_at: new Date().toISOString()
                };
                this.cart.push(cartItem);
            }

            this.saveCart();
            this.renderCart();

            // Показываем уведомление
            this.showNotification(`Товар "${product.name}" добавлен в корзину`, 'success');
        } catch (error) {
            console.error('Ошибка добавления в корзину:', error);
            this.showNotification('Ошибка добавления товара в корзину', 'error');
        }
    }

    // Удаление товара из корзины
    removeFromCart(itemId) {
        this.cart = this.cart.filter(item => item.id !== itemId);
        this.saveCart();
        this.renderCart();

        const item = this.cart.find(i => i.id === itemId);
        if (item) {
            this.showNotification(`Товар "${item.product_name}" удален из корзины`, 'info');
        }
    }

    // Обновление количества товара в корзине
    updateCartItemQuantity(itemId, newQuantity) {
        const item = this.cart.find(i => i.id === itemId);
        if (!item) return;

        if (newQuantity <= 0) {
            this.removeFromCart(itemId);
            return;
        }

        item.quantity = newQuantity;
        this.saveCart();
        this.renderCart();
    }

    // Сохранение корзины в localStorage
    saveCart() {
        storageManager.setLocalStorage('userCart', this.cart);
    }

    // Загрузка корзины из localStorage
    loadCart() {
        this.cart = storageManager.getLocalStorage('userCart') || [];
        this.renderCart();
    }

    // Рендер корзины
    renderCart() {
        const cartContainer = document.getElementById('shoppingCart');
        const cartCount = document.getElementById('cartCount');
        const cartTotal = document.getElementById('cartTotal');

        // Обновляем счетчик товаров в корзине
        const totalItems = this.cart.reduce((sum, item) => sum + item.quantity, 0);
        if (cartCount) cartCount.textContent = totalItems;

        // Обновляем общую сумму
        const total = this.cart.reduce((sum, item) => sum + (item.product_price * item.quantity), 0);
        if (cartTotal) cartTotal.textContent = total.toFixed(2);

        // Рендерим содержимое корзины
        if (cartContainer) {
            if (this.cart.length === 0) {
                cartContainer.innerHTML = '<div class="empty-cart">Корзина пуста</div>';
                return;
            }

            const html = `
                <div class="cart-items">
                    ${this.cart.map(item => this.renderCartItem(item)).join('')}
                </div>
                <div class="cart-summary">
                    <div class="cart-total">
                        <strong>Итого: ${total.toFixed(2)} ₽</strong>
                    </div>
                    <button onclick="shopManager.checkout()" class="btn btn-success checkout-btn">
                        Оформить заказ
                    </button>
                </div>
            `;
            cartContainer.innerHTML = html;
        }
    }

    // Рендер элемента корзины
    renderCartItem(item) {
        return `
            <div class="cart-item" data-item-id="${item.id}">
                <div class="cart-item-image">
                    <img src="${item.product_image || '/images/no-image.png'}" alt="${item.product_name}">
                </div>
                <div class="cart-item-info">
                    <h4 class="cart-item-name">${item.product_name}</h4>
                    <div class="cart-item-price">${item.product_price} ₽</div>
                </div>
                <div class="cart-item-quantity">
                    <button onclick="shopManager.updateCartItemQuantity('${item.id}', ${item.quantity - 1})" class="quantity-btn">-</button>
                    <span class="quantity-value">${item.quantity}</span>
                    <button onclick="shopManager.updateCartItemQuantity('${item.id}', ${item.quantity + 1})" class="quantity-btn">+</button>
                </div>
                <div class="cart-item-total">
                    ${(item.product_price * item.quantity).toFixed(2)} ₽
                </div>
                <button onclick="shopManager.removeFromCart('${item.id}')" class="cart-item-remove">🗑️</button>
            </div>
        `;
    }

    // Проверка активных заказов пользователя
    async checkActiveOrders() {
        if (!this.currentUser) return false;

        // ПРОВЕРКА: Определяем, от чьего имени выполняется действие
        const impersonatedUserStr = sessionStorage.getItem('impersonatedUser');
        const effectiveUserId = impersonatedUserStr ? JSON.parse(impersonatedUserStr).id : this.currentUser.id;

        try {
            const { count, error } = await window.supabase.from('orders').select('*', { count: 'exact', head: true }).eq('user_id', effectiveUserId).in('status', ['pending', 'processing']);
            if (error) throw error;
            if (count > 0) {
                // console.log(`📋 Найден активный заказ (статус 'pending' или 'processing') для пользователя ${effectiveUserId}. Количество: ${count}`);
                return true;
            }

            return false;
        } catch (error) {
            console.error('Ошибка проверки активных заказов:', error);
            return false;
        }
    }

    // Новый метод для получения активного заказа с деталями товара
    async getActiveOrder() {
        if (!this.currentUser) return null;

        // ПРОВЕРКА: Определяем, от чьего имени выполняется действие
        const impersonatedUserStr = sessionStorage.getItem('impersonatedUser');
        const effectiveUserId = impersonatedUserStr ? JSON.parse(impersonatedUserStr).id : this.currentUser.id;

        try {
            const { data: order, error } = await supabase
                .from('orders')
                .select(`
                    *,
                    product:products (name, description, duration_days)
                `)
                .eq('user_id', effectiveUserId)
                .in('status', ['pending', 'processing'])
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle(); // ИСПРАВЛЕНИЕ: Используем maybeSingle() для избежания ошибки 406

            if (error && error.code !== 'PGRST116') throw error; // Игнорируем ошибку "не найдено", но не другие
            return order; // Возвращаем объект заказа или null
        } catch (error) {
            console.error('❌ Ошибка получения активного заказа:', error);
            return null;
        }
    }

    // Оформление заказа
    async checkout() {
        if (!this.currentUser) {
            alert('Необходимо войти в систему для оформления заказа');
            return;
        }

        if (this.cart.length === 0) {
            alert('Корзина пуста');
            return;
        }

        // Проверяем, не обрабатывается ли уже другой заказ
        if (this.isProcessingOrder) {
            this.showNotification('Заказ уже обрабатывается, пожалуйста подождите...', 'warning');
            return;
        }

        // ПРОВЕРКА: Убеждаемся, что у пользователя нет других активных заказов
        const hasActiveOrders = await this.checkActiveOrders(); // Используем новую функцию
        if (hasActiveOrders) {
            this.showNotification('У вас уже есть активный заказ в обработке. Дождитесь ответа администратора.', 'warning');
            return;
        }

        try {
            this.isProcessingOrder = true;

            // Блокируем кнопку оформления заказа
            const checkoutButton = document.querySelector('.checkout-btn');
            if (checkoutButton) {
                checkoutButton.disabled = true;
                checkoutButton.textContent = 'Обрабатывается...';
            }

            // Собираем данные для заказа
            const orderItems = this.cart.map(item => ({
                product_id: item.product_id,
                quantity: item.quantity,
                total_price: item.product_price * item.quantity
            }));
            const totalAmount = orderItems.reduce((sum, item) => sum + item.total_price, 0);

            // Создаем заказ в базе данных
            const { data: order, error } = await supabase
                .from('orders')
                .insert([{
                    user_id: this.currentUser.id,
                    product_id: orderItems[0].product_id, // Предполагаем один товар в заказе для VIP
                    total_amount: totalAmount,
                    status: 'processing',
                    created_at: new Date().toISOString()
                }])
                .select()
                .single();

            if (error) {
                console.error('❌ Ошибка сохранения заказа:', error);
                throw error;
            }

            // console.log('✅ Заказ успешно создан из корзины:', order);

            // Очищаем корзину после успешного заказа
            this.cart = [];
            this.saveCart();
            this.renderCart();

            this.showNotification('✅ Заказ успешно оформлен! Ожидайте ответа администратора.', 'success');

            // Показываем детали заказа
            this.showOrderDetails(order);

        } catch (error) {
            console.error('❌ Ошибка оформления заказа:', error);
            this.showNotification(`Ошибка оформления заказа: ${error.message || 'Неизвестная ошибка'}`, 'error');
        } finally {
            // Разблокируем кнопку в любом случае
            this.isProcessingOrder = false;
            const checkoutButton = document.querySelector('.checkout-btn');
            if (checkoutButton) {
                checkoutButton.disabled = false;
                checkoutButton.textContent = 'Оформить заказ';
            }
        }
    }

    // Новый метод для создания заказа напрямую (для модального окна)
    async createOrder(productId, productName, price) {
        // ПРОВЕРКА: Определяем, от чьего имени выполняется действие
        // ✅ ИСПРАВЛЕНИЕ: Используем authManager.getCurrentUser() для надежного получения
        // данных о пользователе, так как он кеширует сессию и всегда доступен после входа.
        let effectiveUser = authManager.getCurrentUser();
        const impersonatedUserStr = sessionStorage.getItem('impersonatedUser'); // Проверяем имперсонализацию

        if (impersonatedUserStr) { // Если активна имперсонализация, используем ID имперсонируемого пользователя
            const impersonatedProfile = JSON.parse(impersonatedUserStr);
            effectiveUser = { id: impersonatedProfile.id, ...impersonatedProfile };
            // console.log(`🛍️ Заказ создается от имени имперсонируемого пользователя: ${impersonatedProfile.username} (ID: ${effectiveUser.id})`);
        } else {
            // console.log(`🛍️ Заказ создается от имени текущего авторизованного пользователя: ${effectiveUser?.email} (ID: ${effectiveUser?.id})`);
        }

        if (!effectiveUser) {
            this.showNotification('Для доступа к магазину необходимо войти в систему.', 'error');
            if (typeof hideShopModal === 'function') hideShopModal();
            if (typeof showLoginModal === 'function') showLoginModal();
            return;
        }

        // 🔒 ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА VIP СТАТУСА И АКТИВНЫХ ЗАКАЗОВ
        const { data: profile, error: profileError } = await window.supabase.from('profiles').select('is_vip, vip_expires_at, is_banned').eq('id', effectiveUser.id).single();

        if (profileError) {
            this.showNotification('❌ Ошибка проверки статуса пользователя.', 'error');
            console.error('Ошибка получения профиля в createOrder:', profileError.message);
            return;
        }

        if (profile.is_banned) {
            this.showNotification('🚫 Заблокированным пользователям запрещено совершать покупки.', 'error');
            return;
        }

        if (profile.is_vip && (!profile.vip_expires_at || new Date(profile.vip_expires_at) > new Date())) {
            this.showNotification('❌ У вас уже есть активный VIP статус!', 'error');
            if (typeof hideShopModal === 'function') hideShopModal();
            return;
        }

        // САМАЯ ВАЖНАЯ ПРОВЕРКА: есть ли уже заказ в ожидании
        const { count: pendingOrdersCount } = await window.supabase.from('orders').select('*', { count: 'exact', head: true }).eq('user_id', effectiveUser.id).in('status', ['pending', 'processing']);

        if (pendingOrdersCount && pendingOrdersCount > 0) {
            this.showNotification('У вас уже есть заказ в обработке. Дождитесь ответа администратора.', 'warning');
            if (typeof hideShopModal === 'function') hideShopModal();
            return;
        }
        
        if (!confirm(`Вы уверены, что хотите заказать "${productName}" за ${price} руб.?\n\nПосле заказа с вами свяжется администратор для уточнения деталей оплаты.`)) {
            return;
        }
        
        try {
            this.isProcessingOrder = true;
            const { error } = await window.supabase.from('orders').insert({
                user_id: effectiveUser.id,
                product_id: productId,
                total_amount: price,
                status: 'pending' // Ставим статус "в ожидании"
            });

            if (error) throw error;

            this.showNotification('✅ Заказ успешно оформлен! Администратор скоро свяжется с вами.', 'success');
            if (typeof hideShopModal === 'function') hideShopModal();

        } catch (error) {
            console.error('❌ Ошибка создания заказа:', error);
            this.showNotification(`❌ Ошибка создания заказа: ${error.message}`, 'error');
        } finally {
            this.isProcessingOrder = false;
        }
    }

    // Показ деталей заказа
    showOrderDetails(order) {
        const modal = document.createElement('div');
        modal.className = 'order-modal';
        modal.innerHTML = `
            <div class="order-content">
                <h3>Заказ №${order.id} успешно оформлен!</h3>
                <p>Сумма заказа: ${order.total_amount} ₽</p>
                <p>Статус: В обработке</p>
                <p>Администратор свяжется с вами для подтверждения заказа.</p>
                <button onclick="this.parentElement.parentElement.remove()" class="btn btn-primary">OK</button>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Показ уведомления
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    // Поиск товаров
    searchProducts(query) {
        if (!query) {
            this.renderProducts();
            return;
        }

        // ФИЛЬТРАЦИЯ ПРИ ПОИСКЕ: Применяем фильтрацию и к результатам поиска
        let baseProducts = [...this.products];

        // Применяем фильтрацию VIP товаров
        if (this.currentUser && this.userVipInfo) {
            // Проверяем активный VIP статус (включая бесрочный)
            const hasActiveVip = this.hasActiveVipStatus();

            if (hasActiveVip) {
                baseProducts = baseProducts.filter(product => product.category !== 'vip');
            }
        }

        const filteredProducts = baseProducts.filter(product =>
            product.name.toLowerCase().includes(query.toLowerCase()) ||
            product.description.toLowerCase().includes(query.toLowerCase())
        );

        const productsContainer = document.getElementById('shopProducts');
        if (productsContainer) {
            const html = filteredProducts.map(product => this.renderProductCard(product)).join('');
            productsContainer.innerHTML = html.length > 0 ? html : '<div class="no-products">Товары не найдены</div>';
        }
    }

    // Фильтрация товаров по категории
    filterProducts(category) {
        // ПЕРЕЗАГРУЖАЕМ товары с фильтрацией категории И VIP статуса
        this.loadProducts(category);
    }

    // Получение товаров по категории
    getProductsByCategory(category) {
        return this.products.filter(product => product.category === category);
    }

    // Получение популярных товаров
    getPopularProducts(limit = 10) {
        return this.products
            .sort((a, b) => (b.sales_count || 0) - (a.sales_count || 0))
            .slice(0, limit);
    }

    // Получение товаров со скидкой
    getDiscountedProducts() {
        return this.products.filter(product => product.old_price && product.old_price > product.price);
    }

    // Загрузка VIP информации пользователя
    async loadUserVipInfo() {
        if (!this.currentUser) return;

        try {
            // Загружаем VIP информацию с vip_started_at
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('is_vip, vip_expires_at, vip_started_at, role, is_owner') // ИЗМЕНЕНИЕ: Добавляем vip_started_at
                .eq('id', this.currentUser.id)
                .single();


            if (error && error.code !== 'PGRST116') {
                console.error('❌ Ошибка загрузки VIP информации:', error);
                return;
            }

            const profileWithStart = profile || null;

            this.userVipInfo = profileWithStart;
            // console.log('VIP информация загружена:', profileWithStart);
        } catch (error) {
            console.error('Ошибка загрузки VIP информации:', error);
        }
    }

    // Проверка активного VIP статуса (включая бесрочный)
    hasActiveVipStatus() {
        if (!this.userVipInfo || !this.userVipInfo.is_vip) {
            return false;
        }

        // Если нет даты истечения - это бесрочный VIP
        if (!this.userVipInfo.vip_expires_at) {
            return true;
        }

        // Проверяем, не истек ли временный VIP
        const now = new Date();
        const expirationDate = new Date(this.userVipInfo.vip_expires_at);
        
        return expirationDate > now;
    }

    // Получение количества оставшихся дней VIP статуса
    getVipDaysLeft() {
        if (!this.userVipInfo || !this.userVipInfo.is_vip || !this.userVipInfo.vip_expires_at) {
            return 0;
        }

        const now = new Date();
        const expirationDate = new Date(this.userVipInfo.vip_expires_at);

        // Проверяем валидность даты
        if (isNaN(expirationDate.getTime())) {
            console.warn('⚠️ Неверная дата окончания VIP:', this.userVipInfo.vip_expires_at);
            return 0;
        }

        const diffTime = expirationDate - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return Math.max(0, diffDays);
    }

    // Получение уровня VIP на основе количества дней с vip_started_at
    getVipLevel() {
        if (!this.userVipInfo || !this.userVipInfo.is_vip) {
            return 1;
        }

        if (!this.userVipInfo.vip_started_at) {
            // Бессрочный VIP
            return '∞';
        }

        let startDate;
        if (this.userVipInfo.vip_started_at) {
            startDate = new Date(this.userVipInfo.vip_started_at);
        } else {
            // Если vip_started_at не установлена, рассчитываем на основе оставшихся дней
            if (this.userVipInfo.vip_expires_at) {
                const now = new Date();
                const remainingMs = new Date(this.userVipInfo.vip_expires_at).getTime() - now.getTime();
                const remainingDays = Math.floor(remainingMs / (1000 * 60 * 60 * 24));
                console.warn('⚠️ vip_started_at не установлена в магазине, рассчитываем как текущая дата минус оставшиеся дни:', remainingDays);
                startDate = new Date(now);
                startDate.setDate(startDate.getDate() - remainingDays);
            } else {
                // Нет даты окончания - используем текущую дату минус 30 дней
                console.warn('⚠️ vip_started_at и vip_expires_at не установлены, используем текущую дату минус 30 дней');
                startDate = new Date();
                startDate.setDate(startDate.getDate() - 30);
            }
        }

        const now = new Date();
        const vipDays = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

        // Уровень VIP = точное количество дней (минимум 1)
        return Math.max(1, vipDays);
    }

    // Получение цвета для отображения VIP статуса
    getVipStatusColor() {
        const daysLeft = this.getVipDaysLeft();

        if (daysLeft > 30) return '#4caf50'; // Зеленый для долгого VIP
        if (daysLeft > 15) return '#8bc34a'; // Светло-зеленый для среднего VIP
        if (daysLeft > 5) return '#ff9800';  // Желтый для скоро истекающего VIP
        if (daysLeft > 0) return '#f44336';  // Красный для критично истекающего VIP
        return '#757575'; // Серый для истекшего VIP
    }

    // Получение текстового представления VIP статуса
    getVipStatusText() {
        if (!this.userVipInfo || !this.userVipInfo.is_vip) {
            return 'Истек';
        }

        // Если нет даты истечения - это бесрочный VIP, выданный администрацией
        if (!this.userVipInfo.vip_expires_at) {
            return 'бесрочный (выдан администрацией)';
        }

        const now = new Date();
        const expirationDate = new Date(this.userVipInfo.vip_expires_at);

        if (expirationDate <= now) {
            return 'Истек';
        }

        const remainingMs = expirationDate - now;
        const totalSeconds = Math.floor(remainingMs / 1000);
        const days = Math.floor(totalSeconds / (24 * 60 * 60));
        const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60));
        const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
        const seconds = totalSeconds % 60;

        // Показываем дни и время в формате HH:MM:SS
        const timeFormatted = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        const timeDisplay = days > 0 ? `${days} дн. ${timeFormatted}` : timeFormatted;

        return `истекает через ${timeDisplay}`;
    }

    // Получение названия роли на русском языке
    getRoleDisplayName(role) {
        const roleNames = {
            'owner': 'Владелец',
            'admin_senior': 'Старший администратор',
            'admin': 'Администратор',
            'moderator_senior': 'Старший модератор',
            'moderator': 'Модератор',
            'vip': 'VIP-пользователь',
            'user': 'Пользователь'
        };
        return roleNames[role] || role;
    }

    // Настройка обработчиков событий
    setupEventListeners() {
        // Поиск товаров
        const searchInput = document.getElementById('productSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchProducts(e.target.value);
            });
        }

        // Фильтры категорий
        const categoryFilters = document.querySelectorAll('.category-filter');
        categoryFilters.forEach(filter => {
            filter.addEventListener('click', (e) => {
                e.preventDefault();
                this.filterProducts(e.target.dataset.category);
            });
        });
    }
}

// Глобальный экземпляр
const shopManager = new ShopManager();

// Глобальные функции для обратной совместимости
async function initializeShop() {
    return await shopManager.initialize();
}

async function loadShopProducts(category) {
    return await shopManager.loadProducts(category);
}

async function addProductToCart(productId) {
    return await shopManager.addToCart(productId);
}

function removeProductFromCart(itemId) {
    shopManager.removeFromCart(itemId);
}

function updateCartItemQuantity(itemId, quantity) {
    shopManager.updateCartItemQuantity(itemId, quantity);
}

function searchShopProducts(query) {
    shopManager.searchProducts(query);
}

function filterShopProducts(category) {
    shopManager.filterProducts(category);
}

function checkoutOrder() {
    shopManager.checkout();
}

function getProductsByCategory(category) {
    return shopManager.getProductsByCategory(category);
}

function getPopularProducts(limit) {
    return shopManager.getPopularProducts(limit);
}

function getDiscountedProducts() {
    return shopManager.getDiscountedProducts();
}

// Экспорт для модулей
window.shopManager = shopManager;
window.initializeShop = initializeShop;
window.loadShopProducts = loadShopProducts;
window.addProductToCart = addProductToCart;
window.removeProductFromCart = removeProductFromCart;
window.updateCartItemQuantity = updateCartItemQuantity;
window.searchShopProducts = searchShopProducts;
window.filterShopProducts = filterShopProducts;
window.checkoutOrder = checkoutOrder;
window.getProductsByCategory = getProductsByCategory;
window.getPopularProducts = getPopularProducts;
window.getDiscountedProducts = getDiscountedProducts;

// console.log('✅ Модуль системы магазина загружен');