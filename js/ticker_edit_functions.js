// ==========================================
// 📢 ФУНКЦИИ РЕДАКТИРОВАНИЯ СООБЩЕНИЙ БЕГУЩЕЙ СТРОКИ
// ==========================================

// Редактировать сообщение
function editTickerMessage(id) {
    const message = tickerContent.find(m => m.content_id === id);
    if (!message) return;

    const formDiv = document.createElement('div');
    formDiv.style.cssText = 'background: rgba(0,0,0,0.8); border: 2px solid #ffd700; border-radius: 8px; padding: 15px; margin-bottom: 10px;';
    formDiv.innerHTML = `
        <h5 style="color: #ffd700; margin: 0 0 10px 0;">✏️ Редактировать сообщение</h5>
        <input type="hidden" id="editId" value="${id}">
        <input type="text" id="editTitle" placeholder="Заголовок" value="${message.title || ''}" style="width: 100%; padding: 8px; margin-bottom: 8px; background: rgba(255,215,0,0.1); border: 1px solid #ffd700; border-radius: 4px; color: #ffd700;">
        <textarea id="editText" placeholder="Текст сообщения" style="width: 100%; padding: 8px; margin-bottom: 8px; background: rgba(255,215,0,0.1); border: 1px solid #ffd700; border-radius: 4px; color: #ffd700; resize: vertical; height: 60px;">${message.message_text}</textarea>
        <div style="display: flex; gap: 8px; margin-bottom: 8px;">
            <input type="text" id="editIcon" placeholder="Иконка" value="${message.icon || '📢'}" style="width: 60px; padding: 8px; background: rgba(255,215,0,0.1); border: 1px solid #ffd700; border-radius: 4px; color: #ffd700; text-align: center;">
            <input type="color" id="editColor" value="${message.text_color || '#ffd700'}" title="Цвет текста" style="width: 50px; padding: 4px; cursor: pointer;">
            <input type="number" id="editPriority" placeholder="Приоритет" value="${message.priority || 5}" min="1" max="20" style="flex: 1; padding: 8px; background: rgba(255,215,0,0.1); border: 1px solid #ffd700; border-radius: 4px; color: #ffd700;">
        </div>
        <div style="display: flex; gap: 10px;">
            <button onclick="saveTickerEdit()" style="background: #00b894; color: white; border: none; padding: 8px 20px; border-radius: 5px; cursor: pointer; font-size: 11px; font-weight: bold;">✅ Сохранить</button>
            <button onclick="cancelTickerEdit()" style="background: #ff4757; color: white; border: none; padding: 8px 20px; border-radius: 5px; cursor: pointer; font-size: 11px; font-weight: bold;">❌ Отмена</button>
        </div>
    `;

    // Находим родительский элемент и вставляем форму перед ним
    const messageElement = document.querySelector(`[data-message-id="${id}"]`);
    if (messageElement) {
        messageElement.parentNode.insertBefore(formDiv, messageElement);
        messageElement.style.display = 'none';
    }
}

// Сохранить редактирование
async function saveTickerEdit() {
    const id = document.getElementById('editId').value;
    const title = document.getElementById('editTitle').value.trim();
    const text = document.getElementById('editText').value.trim();
    const icon = document.getElementById('editIcon').value;
    const color = document.getElementById('editColor').value;
    const priority = parseInt(document.getElementById('editPriority').value);

    if (!text) {
        showNotification('❌ Введите текст сообщения!', 'error');
        return;
    }

    const messageDiv = document.getElementById('tickerMessage');
    messageDiv.style.display = 'block';
    messageDiv.style.background = '#667eea';
    messageDiv.style.color = 'white';
    messageDiv.textContent = '🔄 Сохранение...';

    try {
        const { data, error } = await supabase
            .from('ticker_content')
            .update({
                title: title || null,
                message_text: text,
                icon: icon,
                text_color: color,
                priority: priority,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);

        if (error) throw error;

        messageDiv.style.background = '#00b894';
        messageDiv.textContent = '✅ Сообщение обновлено!';
        
        cancelTickerEdit();
        setTimeout(() => loadTickerContent(), 1000);
        
    } catch (error) {
        console.error('Ошибка:', error);
        messageDiv.style.background = '#ff4757';
        messageDiv.textContent = `❌ ${error.message}`;
    }
}

// Отменить редактирование
function cancelTickerEdit() {
    const form = document.querySelector('[style*="background: rgba(0,0,0,0.8)"]');
    if (form) form.remove();
    
    const hiddenMessage = document.querySelector('[style*="display: none"][data-message-id]');
    if (hiddenMessage) hiddenMessage.style.display = '';
}

// Обновляем функцию отображения для добавления кнопки редактирования
function displayTickerContent() {
    const container = document.getElementById('tickerContentList');
    
    if (!tickerContent || tickerContent.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: #00b894;">Сообщений нет</div>';
        return;
    }

    const typeLabels = {
        'warning': '⚠️ Предупр.', 'ban': '🚫 Блок.', 'vip': '👑 VIP',
        'ad': '📢 Реклама', 'promo': '🎁 Промо', 'mod_new': '✨ Новинка',
        'mod_updated': '🔄 Обновл.', 'product': '🛒 Товар', 'system': 'ℹ️ Система', 'custom': '💬 Другое'
    };
    
    const targetLabels = {
        'all': '👥 Все', 'guests': '👤 Гости', 'registered': '✅ Регистр.',
        'vip_only': '👑 VIP', 'non_vip': '🚫 Не-VIP'
    };

    container.innerHTML = tickerContent.map(item => {
        const statusColor = item.is_active ? '#00b894' : '#ff4757';
        const priorityColor = item.priority >= 18 ? '#ff4757' : item.priority >= 12 ? '#ffd700' : '#00b894';
        
        return `
            <div style="background: rgba(0,0,0,0.3); border-left: 3px solid ${priorityColor}; border-radius: 6px; margin-bottom: 8px; padding: 10px;" data-message-id="${item.content_id}">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div style="flex: 1;">
                        <div style="font-size: 10px; color: #888; margin-bottom: 3px;">
                            <span style="color: ${priorityColor}; font-weight: bold;">[${item.priority}]</span>
                            ${typeLabels[item.content_type] || item.content_type} | 
                            ${targetLabels[item.target_audience] || item.target_audience} |
                            <span style="color: ${statusColor};">${item.is_active ? '✅ Активно' : '❌ Откл.'}</span>
                        </div>
                        <div style="color: #fff; font-size: 12px; margin-bottom: 3px;">${item.title || ''}</div>
                        <div style="color: #aaa; font-size: 11px;">${item.message_text.substring(0, 80)}${item.message_text.length > 80 ? '...' : ''}</div>
                    </div>
                    <div style="display: flex; gap: 4px; margin-left: 8px;">
                        <button onclick="editTickerMessage('${item.content_id}')" style="background: #4fc3f7; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 9px;">✏️</button>
                        <button onclick="toggleTickerItem('${item.content_id}', ${!item.is_active})" style="background: ${item.is_active ? '#fdcb6e' : '#00b894'}; color: ${item.is_active ? '#000' : '#fff'}; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 9px;">${item.is_active ? '⏸️' : '▶️'}</button>
                        <button onclick="deleteTickerItem('${item.content_id}')" style="background: #ff4757; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 9px;">🗑️</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}
