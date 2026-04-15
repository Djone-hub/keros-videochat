// Функции управления заказами
window.approveOrder = async function(orderId) {
    try {
        // console.log('🔄 Начинаем одобрение заказа:', orderId);
        
        // Сначала получаем информацию о заказе
        const { data: order, error: fetchError } = await window.supabase
            .from('orders')
            .select(`
                user_id, 
                product_id, 
                status,
                profiles!orders_user_id_fkey (email),
                products!orders_product_id_fkey (duration_days)
            `)
            .eq('id', orderId)
            .single();
            
        if (fetchError) {
            console.error('❌ Ошибка при получении заказа:', fetchError);
            ModalNotification.show(`Ошибка при получении заказа: ${fetchError.message}`, 'error');
            return;
        }
        
        // console.log('📦 Информация о заказе:', order);
        
        // Обновляем статус заказа
        const { error } = await window.supabase
            .from('orders')
            .update({ status: 'completed' })
            .eq('id', orderId);
            
        if (error) {
            console.error('❌ Ошибка при обновлении статуса заказа:', error);
            ModalNotification.show(`Ошибка при одобрении заказа: ${error.message}`, 'error');
            return;
        }
        
        // console.log('✅ Статус заказа обновлен на completed');
        
        // Активируем VIP-статус пользователю
        const vipExpiresAt = new Date();
        vipExpiresAt.setTime(vipExpiresAt.getTime() + (order.products?.duration_days || 0) * 60 * 1000); // Прибавляем минуты
        
        // console.log('💎 Активируем VIP до:', vipExpiresAt.toISOString());
        // console.log('👤 Email пользователя:', order.profiles?.email);
        
        const { error: vipError } = await window.supabase
            .from('profiles')
            .update({ 
                is_vip: true, 
                vip_expires_at: vipExpiresAt.toISOString(),
                vip_started_at: new Date().toISOString()
            })
            .eq('email', order.profiles?.email);  // ИСПРАВЛЕНИЕ: ищем по email
            
        if (vipError) {
            console.error('❌ Ошибка при активации VIP:', vipError);
            ModalNotification.show('Заказ одобрен, но VIP-статус не активирован! Ошибка: ' + vipError.message, 'warning');
        } else {
            // console.log('✅ VIP-статус успешно активирован');
            ModalNotification.show('Заказ одобрен и VIP-статус активирован!', 'success');

            // Обновляем информацию о пользователе в реальном времени
            if (window.authManager && typeof window.authManager.refreshUserProfile === 'function') {
                await window.authManager.refreshUserProfile();
            }

            // ✅ УБРАНА ПЕРЕЗАГРУЗКА - теперь обновляем только интерфейс
            // setTimeout(() => {
            //     window.location.reload();
            // }, 2000);
        }

        window.loadOrders(); // Перезагружаем список заказов
    } catch (err) {
        console.error('❌ Ошибка при одобрении заказа:', err);
        ModalNotification.show(`Ошибка при одобрении заказа: ${err.message}`, 'error');
    }
};

window.rejectOrder = async function(orderId) {
    if (!confirm('Вы уверены, что хотите отклонить заказ?')) return;
    
    try {
        const { error } = await window.supabase
            .from('orders')
            .update({ status: 'cancelled' })
            .eq('id', orderId);
            
        if (error) {
            ModalNotification.show(`Ошибка при отклонении заказа: ${error.message}`, 'error');
            return;
        }
        
        ModalNotification.show('Заказ отклонен!', 'warning');
        window.loadOrders(); // Перезагружаем список заказов
    } catch (err) {
        console.error('Ошибка при отклонении заказа:', err);
        ModalNotification.show(`Ошибка при отклонении заказа: ${err.message}`, 'error');
    }
};

window.completeOrder = async function(orderId) {
    try {
        const { error } = await window.supabase
            .from('orders')
            .update({ status: 'completed' })
            .eq('id', orderId);
            
        if (error) {
            ModalNotification.show(`Ошибка при завершении заказа: ${error.message}`, 'error');
            return;
        }
        
        ModalNotification.show('Заказ завершен!', 'success');
        window.loadOrders(); // Перезагружаем список заказов
    } catch (err) {
        console.error('Ошибка при завершении заказа:', err);
        ModalNotification.show(`Ошибка при завершении заказа: ${err.message}`, 'error');
    }
};

window.deleteOrder = async function(orderId) {
    if (!confirm('Вы уверены, что хотите удалить заказ? Это действие необратимо!')) return;
    
    try {
        const { error } = await window.supabase
            .from('orders')
            .delete()
            .eq('id', orderId);
            
        if (error) {
            ModalNotification.show(`Ошибка при удалении заказа: ${error.message}`, 'error');
            return;
        }
        
        ModalNotification.show('Заказ удален!', 'info');
        window.loadOrders(); // Перезагружаем список заказов
    } catch (err) {
        console.error('Ошибка при удалении заказа:', err);
        ModalNotification.show(`Ошибка при удалении заказа: ${err.message}`, 'error');
    }
};

// console.log('✅ Функции управления заказами загружены');
