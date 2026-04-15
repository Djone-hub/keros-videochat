(function() {
    'use strict';
    
    // Функция форматирования минут в читаемый срок
    function formatDurationFromMinutes(minutes) {
        if (!minutes) return '';
        
        if (minutes >= 30.42 * 24 * 60) {
            return `${Math.floor(minutes / (30.42 * 24 * 60))} мес.`;
        } else if (minutes >= 24 * 60) {
            return `${Math.floor(minutes / (24 * 60))} дн.`;
        } else if (minutes >= 60) {
            return `${Math.floor(minutes / 60)} час`;
        } else {
            return `${minutes} мин.`;
        }
    }
    
    window.loadOrders = async function() {
        const contentArea = document.getElementById('admin-content-area');
        if (!contentArea) {
            console.log('❌ Элемент #admin-content-area не найден');
            return;
        }

        contentArea.innerHTML = `<div style="color: #00ff41; padding: 1rem; text-align: center;">📦 Загрузка заказов...</div>`;

        try {
            // Запрос с JOIN для получения полной информации о пользователе и продукте
            const { data: orders, error } = await window.supabase
                .from('orders')
                .select(`
                    id, 
                    user_id, 
                    product_id, 
                    total_amount, 
                    status, 
                    created_at,
                    profiles!orders_user_id_fkey (
                        username,
                        email
                    ),
                    products!orders_product_id_fkey (
                        name,
                        duration_days
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (!orders || orders.length === 0) {
                contentArea.innerHTML = `
                    <div style="color: #00ff41; padding: 1rem; text-align: center;">📦 Нет заказов</div>
                `;
                return;
            }

            let ordersHtml = `
                <div style="color: #00ff41; padding: 1rem; text-align: center;">
                    <h4>📦 Управление заказами (${orders.length})</h4>
                    <div style="max-height: 450px; overflow-y: auto; padding-right: 10px;">
            `;

            orders.forEach(order => {
                let statusText = '❌ Отменен';
                let statusColor = '#f44336';
                let actionButtons = '';
                
                if (order.status === 'completed') {
                    statusText = '✅ Завершен';
                    statusColor = '#4CAF50';
                    actionButtons = `
                        <div style="margin-top: 10px; display: flex; gap: 5px; justify-content: flex-end;">
                            <button onclick="deleteOrder('${order.id}')" 
                                    style="background: #f44336; color: white; padding: 5px 10px; border: none; border-radius: 3px; cursor: pointer; font-size: 0.8rem;"
                                    title="Удалить заказ">
                                🗑️ Удалить
                            </button>
                        </div>
                    `;
                } else if (order.status === 'pending') {
                    statusText = '⏳ В обработке';
                    statusColor = '#ff9800';
                    actionButtons = `
                        <div style="margin-top: 10px; display: flex; gap: 5px; justify-content: flex-end;">
                            <button onclick="showOrderContact('${order.id}', '${order.profiles?.email || ''}')" 
                                    style="background: #2196F3; color: white; padding: 5px 10px; border: none; border-radius: 3px; cursor: pointer; font-size: 0.8rem;"
                                    title="Связаться с клиентом">
                                📞 Связаться
                            </button>
                            <button onclick="approveOrder('${order.id}')" 
                                    style="background: #4CAF50; color: white; padding: 5px 10px; border: none; border-radius: 3px; cursor: pointer; font-size: 0.8rem;"
                                    title="Одобрить и выдать VIP">
                                ✅ Одобрить
                            </button>
                            <button onclick="rejectOrder('${order.id}')" 
                                    style="background: #f44336; color: white; padding: 5px 10px; border: none; border-radius: 3px; cursor: pointer; font-size: 0.8rem;"
                                    title="Отклонить заказ">
                                ❌ Отклонить
                            </button>
                        </div>
                    `;
                } else if (order.status === 'cancelled') {
                    statusText = '❌ Отклонен';
                    statusColor = '#f44336';
                    actionButtons = `
                        <div style="margin-top: 10px; display: flex; gap: 5px; justify-content: flex-end;">
                            <button onclick="deleteOrder('${order.id}')" 
                                    style="background: #f44336; color: white; padding: 5px 10px; border: none; border-radius: 3px; cursor: pointer; font-size: 0.8rem;"
                                    title="Удалить заказ">
                                🗑️ Удалить
                            </button>
                        </div>
                    `;
                }

                ordersHtml += `
                    <div style="background: rgba(0, 255, 65, 0.05); padding: 15px; border-radius: 8px; border: 1px solid rgba(0, 255, 65, 0.2); margin-bottom: 10px;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                            <div style="flex: 1;">
                                <strong style="color: #00ff41;">Заказ #${order.id}</strong>
                                <div style="font-size: 0.8rem; color: #ccd6f6; margin-top: 5px;">
                                    📅 ${order.created_at ? new Date(order.created_at).toLocaleString('ru-RU') : 'Нет даты'}
                                </div>
                                <div style="font-size: 0.8rem; color: #ccd6f6; margin-top: 3px;">
                                    👤 Пользователь: ${order.profiles?.user_metadata?.username || (order.profiles?.email ? order.profiles.email.split('@')[0].charAt(0).toUpperCase() + order.profiles.email.split('@')[0].slice(1) : 'Неизвестен')}
                                </div>
                                <div style="font-size: 0.8rem; color: #64ffda; margin-top: 3px;">
                                    📧 Email: ${order.profiles?.email || 'Нет email'}
                                </div>
                                <div style="font-size: 0.8rem; color: #ccd6f6; margin-top: 3px;">
                                    📦 Продукт: ${order.products?.name || 'Неизвестен'} ${order.products?.duration_days ? `(${formatDurationFromMinutes(order.products.duration_days)})` : ''}
                                </div>
                            </div>
                            <div style="text-align: right; margin-left: 15px; min-width: 150px; flex-shrink: 0;">
                                <div style="font-weight: bold; color: #ffd700; font-size: 1.1rem;">${order.total_amount} руб.</div>
                                <div style="color: ${statusColor}; font-weight: bold; font-size: 0.8rem; margin-top: 5px;">
                                    ${statusText}
                                </div>
                                ${actionButtons}
                            </div>
                        </div>
                    </div>
                `;
            });

            ordersHtml += `
                    </div>
                </div>
            `;

            contentArea.innerHTML = ordersHtml;

        } catch (err) {
            console.error('Критическая ошибка в loadOrders:', err);
            contentArea.innerHTML = `
                <div style="color: #f44336; padding: 2rem; text-align: center;">
                    <h4>❌ Ошибка загрузки заказов</h4>
                    <p>${err.message}</p>
                    <p style="font-size: 0.8rem; color: #8892b0;">Проверьте консоль для детальной информации</p>
                </div>
            `;
        }
    };
    
    // Функция удаления заказа
    window.deleteOrder = async function(orderId) {
        if (!confirm('Вы уверены, что хотите удалить этот заказ?')) {
            return;
        }
        
        try {
            const { error } = await window.supabase
                .from('orders')
                .delete()
                .eq('id', orderId);
                
            if (error) throw error;
            
            // Показываем уведомление об успехе
            if (typeof ModalNotification === 'object' && ModalNotification.show) {
                ModalNotification.show('✅ Заказ успешно удален', 'success');
            } else {
                alert('✅ Заказ успешно удален');
            }
            
            // Перезагружаем список заказов
            window.loadOrders();
            
        } catch (error) {
            console.error('Ошибка удаления заказа:', error);
            if (typeof ModalNotification === 'object' && ModalNotification.show) {
                ModalNotification.show('❌ Ошибка при удалении заказа', 'error');
            } else {
                alert('❌ Ошибка при удалении заказа');
            }
        }
    };
    
    // Функция показа контактной информации
    window.showOrderContact = function(orderId, email) {
        const contactHtml = `
            <div style="color: #00ff41; padding: 20px; max-width: 500px;">
                <h4 style="margin-bottom: 20px;">📞 Связаться с клиентом</h4>
                
                <div style="background: rgba(33, 150, 243, 0.1); padding: 15px; border-radius: 8px; border: 1px solid rgba(33, 150, 243, 0.3); margin-bottom: 20px;">
                    <h5 style="color: #2196F3; margin-bottom: 10px;">📧 Email</h5>
                    <div style="color: #ccd6f6; word-break: break-all;">${email}</div>
                    <button onclick="window.open('mailto:${email}')" 
                            style="background: #2196F3; color: white; padding: 8px 15px; border: none; border-radius: 5px; cursor: pointer; margin-top: 10px;">
                        ✉️ Написать письмо
                    </button>
                </div>
                
                <div style="background: rgba(76, 175, 80, 0.1); padding: 15px; border-radius: 8px; border: 1px solid rgba(76, 175, 80, 0.3); margin-bottom: 20px;">
                    <h5 style="color: #4CAF50; margin-bottom: 10px;">💬 Мессенджеры</h5>
                    <p style="color: #ccd6f6; font-size: 0.9rem; margin-bottom: 10px;">
                        Вы можете связаться с клиентом через любые удобные мессенджеры:
                    </p>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px;">
                        <button onclick="window.open('https://t.me/')" 
                                style="background: #0088cc; color: white; padding: 8px 12px; border: none; border-radius: 5px; cursor: pointer; font-size: 0.8rem;">
                            📱 Telegram
                        </button>
                        <button onclick="window.open('https://vk.com/')" 
                                style="background: #0077FF; color: white; padding: 8px 12px; border: none; border-radius: 5px; cursor: pointer; font-size: 0.8rem;">
                            💬 VK
                        </button>
                        <button onclick="window.open('https://wa.me/')" 
                                style="background: #25D366; color: white; padding: 8px 12px; border: none; border-radius: 5px; cursor: pointer; font-size: 0.8rem;">
                            📞 WhatsApp
                        </button>
                    </div>
                </div>
                
                <div style="background: rgba(255, 152, 0, 0.1); padding: 15px; border-radius: 8px; border: 1px solid rgba(255, 152, 0, 0.3);">
                    <h5 style="color: #ff9800; margin-bottom: 10px;">💰 Способы оплаты</h5>
                    <p style="color: #ccd6f6; font-size: 0.9rem; margin-bottom: 10px;">
                        После подтверждения оплаты вы можете вручную выдать VIP статус через кнопку "✅ Одобрить"
                    </p>
                    <div style="color: #64ffda; font-size: 0.8rem;">
                        <div>• 💳 Карта</div>
                        <div>• 📱 СБП</div>
                        <div>• 💰 QIWI</div>
                        <div>• 🪙 Криптовалюта</div>
                    </div>
                </div>
                
                <div style="display: flex; gap: 10px; margin-top: 20px;">
                    <button onclick="this.closest('.modal-overlay')?.remove()" 
                            style="background: #666; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer;">
                        Закрыть
                    </button>
                </div>
            </div>
        `;
        
        // Создаем модальное окно
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-overlay';
        modalOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;
        
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: linear-gradient(135deg, #0f1419, #1a1f2e);
            border-radius: 10px;
            border: 1px solid #00ff41;
            max-width: 90%;
            max-height: 90%;
            overflow-y: auto;
            position: relative;
        `;
        
        modalContent.innerHTML = contactHtml;
        modalOverlay.appendChild(modalContent);
        document.body.appendChild(modalOverlay);
        
        // Закрытие по клику вне модального окна
        modalOverlay.addEventListener('click', function(e) {
            if (e.target === modalOverlay) {
                modalOverlay.remove();
            }
        });
    };
    
    // console.log('✅ Минимальная версия loadOrders загружена');
})();
