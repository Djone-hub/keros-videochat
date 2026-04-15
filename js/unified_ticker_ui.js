// ==========================================
// 🎯 ЕДИНОЕ УПРАВЛЕНИЕ БЕГУЩЕЙ СТРОКОЙ
// ==========================================

let tickerContent = [];

function showUnifiedTickerManagement() {
    const contentArea = document.getElementById('admin-content-area');
    if (!contentArea) return;

    contentArea.innerHTML = `
        <div style="color: #ffd700; padding: 15px;">
            <h3 style="margin: 0 0 15px 0; text-shadow: 0 0 10px #ffd700;">🎯 Управление бегущей строкой</h3>
            
            <div style="background: linear-gradient(45deg, #00b894, #00cec9); color: #000; padding: 12px; border-radius: 8px; margin-bottom: 15px; text-align: center; font-weight: bold; font-size: 11px;">
                📢 Единая система: Предупреждения | Блокировки | VIP | Реклама | Новинки
            </div>

            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 15px;">
                <div style="background: rgba(255,71,87,0.2); padding: 8px; border-radius: 6px; text-align: center; border: 1px solid rgba(255,71,87,0.3);">
                    <div id="tickerWarnings" style="font-size: 1.3em; font-weight: bold; color: #ff4757;">0</div>
                    <div style="font-size: 9px; color: #ff4757;">⚠️ Предупр.</div>
                </div>
                <div style="background: rgba(0,0,0,0.3); padding: 8px; border-radius: 6px; text-align: center; border: 1px solid rgba(255,0,0,0.3);">
                    <div id="tickerBans" style="font-size: 1.3em; font-weight: bold; color: #ff0000;">0</div>
                    <div style="font-size: 9px; color: #ff0000;">🚫 Блок.</div>
                </div>
                <div style="background: rgba(255,215,0,0.2); padding: 8px; border-radius: 6px; text-align: center; border: 1px solid rgba(255,215,0,0.3);">
                    <div id="tickerAds" style="font-size: 1.3em; font-weight: bold; color: #ffd700;">0</div>
                    <div style="font-size: 9px; color: #ffd700;">📢 Реклама</div>
                </div>
                <div style="background: rgba(0,184,148,0.2); padding: 8px; border-radius: 6px; text-align: center; border: 1px solid rgba(0,184,148,0.3);">
                    <div id="tickerTotal" style="font-size: 1.3em; font-weight: bold; color: #00b894;">0</div>
                    <div style="font-size: 9px; color: #00b894;">📊 Всего</div>
                </div>
            </div>

            <div style="margin-bottom: 15px; display: flex; gap: 8px; flex-wrap: wrap;">
                <button onclick="loadTickerContent()" style="background: #667eea; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; font-size: 11px; font-weight: bold;">🔄 Загрузить</button>
                <button onclick="showAddTickerForm()" style="background: #00b894; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; font-size: 11px; font-weight: bold;">➕ Добавить</button>
                <button onclick="refreshAutoContent()" style="background: #fdcb6e; color: #000; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; font-size: 11px; font-weight: bold;">🔄 Авто-генерация</button>
            </div>

            <div id="tickerForm" style="display: none; background: rgba(0,0,0,0.5); padding: 15px; border-radius: 8px; margin-bottom: 15px; border: 1px solid #00b894;">
                <h4 style="color: #00b894; margin: 0 0 10px 0;">📝 Новое сообщение</h4>
                <select id="tickerType" style="width: 100%; padding: 8px; margin-bottom: 8px; background: rgba(0,184,148,0.1); border: 1px solid #00b894; border-radius: 4px; color: #00b894;" onchange="updateTickerForm()">
                    <option value="ad">📢 Реклама</option>
                    <option value="promo">🎁 Акция/Промо</option>
                    <option value="mod_new">✨ Новый мод</option>
                    <option value="mod_updated">🔄 Обновление мода</option>
                    <option value="product">🛒 Товар/Услуга</option>
                    <option value="system">ℹ️ Системное</option>
                    <option value="custom">💬 Произвольное</option>
                </select>
                <input type="text" id="tickerTitle" placeholder="Заголовок (опционально)" style="width: 100%; padding: 8px; margin-bottom: 8px; background: rgba(0,184,148,0.1); border: 1px solid #00b894; border-radius: 4px; color: #00b894;">
                <textarea id="tickerText" placeholder="Текст сообщения" style="width: 100%; padding: 8px; margin-bottom: 8px; background: rgba(0,184,148,0.1); border: 1px solid #00b894; border-radius: 4px; color: #00b894; resize: vertical; height: 60px;"></textarea>
                <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                    <input type="text" id="tickerIcon" placeholder="Иконка" value="📢" style="width: 60px; padding: 8px; background: rgba(0,184,148,0.1); border: 1px solid #00b894; border-radius: 4px; color: #00b894; text-align: center;">
                    <input type="color" id="tickerColor" value="#ffd700" title="Цвет текста" style="width: 50px; padding: 4px; cursor: pointer;">
                    <select id="tickerPriority" style="flex: 1; padding: 8px; background: rgba(0,184,148,0.1); border: 1px solid #00b894; border-radius: 4px; color: #00b894;">
                        <option value="20">🔴 20 - Максимальный</option>
                        <option value="18">🟠 18 - Критический</option>
                        <option value="15">🟡 15 - Высокий</option>
                        <option value="12" selected>🟢 12 - Средний</option>
                        <option value="8">🔵 8 - Ниже среднего</option>
                        <option value="5">⚪ 5 - Низкий</option>
                        <option value="2">⚪ 2 - Фоновый</option>
                    </select>
                </div>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 8px;">
                    <select id="tickerTarget" style="padding: 8px; background: rgba(0,184,148,0.1); border: 1px solid #00b894; border-radius: 4px; color: #00b894;">
                        <option value="all">👥 Все</option>
                        <option value="guests">👤 Гости</option>
                        <option value="registered">✅ Зарегистр.</option>
                        <option value="vip_only">👑 Только VIP</option>
                        <option value="non_vip">🚫 Не-VIP</option>
                    </select>
                    <input type="text" id="tickerUrl" placeholder="URL (опционально)" style="padding: 8px; background: rgba(0,184,148,0.1); border: 1px solid #00b894; border-radius: 4px; color: #00b894;">
                </div>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 8px;">
                    <input type="datetime-local" id="tickerStart" placeholder="Начало" style="padding: 8px; background: rgba(0,184,148,0.1); border: 1px solid #00b894; border-radius: 4px; color: #00b894;">
                    <input type="datetime-local" id="tickerEnd" placeholder="Окончание" style="padding: 8px; background: rgba(0,184,148,0.1); border: 1px solid #00b894; border-radius: 4px; color: #00b894;">
                </div>
                <div style="display: flex; gap: 10px;">
                    <button onclick="createTickerContent()" style="background: #00b894; color: white; border: none; padding: 8px 20px; border-radius: 5px; cursor: pointer; font-size: 11px; font-weight: bold;">✅ Добавить</button>
                    <button onclick="hideTickerForm()" style="background: #ff4757; color: white; border: none; padding: 8px 20px; border-radius: 5px; cursor: pointer; font-size: 11px; font-weight: bold;">❌ Отмена</button>
                </div>
            </div>

            <div id="tickerMessage" style="margin-bottom: 15px; padding: 10px; border-radius: 5px; text-align: center; font-size: 11px; display: none;"></div>

            <div id="tickerContentList" style="max-height: 400px; overflow-y: auto;">
                <div style="padding: 30px; text-align: center; color: #00b894;">
                    🔄 Нажмите "Загрузить" для отображения сообщений
                </div>
            </div>
        </div>
    `;
}

function showAddTickerForm() {
    document.getElementById('tickerForm').style.display = 'block';
}

function hideTickerForm() {
    document.getElementById('tickerForm').style.display = 'none';
    document.getElementById('tickerText').value = '';
    document.getElementById('tickerTitle').value = '';
}

function updateTickerForm() {
    const type = document.getElementById('tickerType').value;
    const icons = {
        'ad': '📢', 'promo': '🎁', 'mod_new': '✨', 'mod_updated': '🔄',
        'product': '🛒', 'system': 'ℹ️', 'custom': '💬'
    };
    const colors = {
        'ad': '#ffd700', 'promo': '#ff6b6b', 'mod_new': '#9c27b0', 'mod_updated': '#4ecdc4',
        'product': '#00b894', 'system': '#4fc3f7', 'custom': '#ffd93d'
    };
    document.getElementById('tickerIcon').value = icons[type] || '📢';
    document.getElementById('tickerColor').value = colors[type] || '#ffd700';
}

async function loadTickerContent() {
    const messageDiv = document.getElementById('tickerMessage');
    const container = document.getElementById('tickerContentList');
    
    messageDiv.style.display = 'block';
    messageDiv.style.background = '#667eea';
    messageDiv.style.color = 'white';
    messageDiv.textContent = '🔄 Загрузка...';

    try {
        const { data, error } = await supabase.rpc('get_all_ticker_content');
        if (error) throw error;

        tickerContent = data || [];
        displayTickerContent();

        // Обновляем статистику
        const warnings = tickerContent.filter(c => c.content_type === 'warning').length;
        const bans = tickerContent.filter(c => c.content_type === 'ban').length;
        const ads = tickerContent.filter(c => c.content_type === 'ad' || c.content_type === 'promo').length;
        
        document.getElementById('tickerWarnings').textContent = warnings;
        document.getElementById('tickerBans').textContent = bans;
        document.getElementById('tickerAds').textContent = ads;
        document.getElementById('tickerTotal').textContent = tickerContent.length;

        messageDiv.style.background = '#00b894';
        messageDiv.textContent = `✅ Загружено ${tickerContent.length} сообщений`;
        setTimeout(() => messageDiv.style.display = 'none', 3000);
        
    } catch (error) {
        console.error('Ошибка:', error);
        messageDiv.style.background = '#ff4757';
        messageDiv.textContent = `❌ ${error.message}`;
    }
}

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
            <div style="background: rgba(0,0,0,0.3); border-left: 3px solid ${priorityColor}; border-radius: 6px; margin-bottom: 8px; padding: 10px;">
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
                        <button onclick="toggleTickerItem('${item.id}', ${!item.is_active})" style="background: ${item.is_active ? '#fdcb6e' : '#00b894'}; color: ${item.is_active ? '#000' : '#fff'}; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 9px;">${item.is_active ? '⏸️' : '▶️'}</button>
                        <button onclick="deleteTickerItem('${item.id}')" style="background: #ff4757; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 9px;">🗑️</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

async function createTickerContent() {
    const type = document.getElementById('tickerType').value;
    const title = document.getElementById('tickerTitle').value.trim();
    const text = document.getElementById('tickerText').value.trim();
    const icon = document.getElementById('tickerIcon').value;
    const color = document.getElementById('tickerColor').value;
    const priority = parseInt(document.getElementById('tickerPriority').value);
    const target = document.getElementById('tickerTarget').value;
    const url = document.getElementById('tickerUrl').value.trim() || null;
    const start = document.getElementById('tickerStart').value || null;
    const end = document.getElementById('tickerEnd').value || null;

    if (!text) {
        showNotification('❌ Введите текст!', 'error');
        return;
    }

    const messageDiv = document.getElementById('tickerMessage');
    messageDiv.style.display = 'block';
    messageDiv.style.background = '#667eea';
    messageDiv.style.color = 'white';
    messageDiv.textContent = '🔄 Добавление...';

    try {
        const { data, error } = await supabase.rpc('add_ticker_ad', {
            p_message_text: text,
            p_title: title || null,
            p_icon: icon,
            p_text_color: color,
            p_bg_color: color + '20',
            p_priority: priority,
            p_target_audience: target,
            p_start_date: start,
            p_end_date: end,
            p_click_url: url
        });

        if (error) throw error;

        messageDiv.style.background = '#00b894';
        messageDiv.textContent = '✅ Добавлено! ID: ' + data;
        hideTickerForm();
        setTimeout(() => loadTickerContent(), 1000);
        
    } catch (error) {
        console.error('Ошибка:', error);
        messageDiv.style.background = '#ff4757';
        messageDiv.textContent = `❌ ${error.message}`;
    }
}

async function toggleTickerItem(id, active) {
    try {
        const { data, error } = await supabase.rpc('toggle_ticker_content', {
            p_id: id,
            p_active: active
        });
        if (error) throw error;
        if (data) {
            showNotification(active ? '✅ Активировано' : '⏸️ Отключено', 'success');
            loadTickerContent();
        }
    } catch (error) {
        showNotification(`❌ ${error.message}`, 'error');
    }
}

async function deleteTickerItem(id) {
    if (!confirm('Удалить это сообщение?')) return;

    try {
        const { data, error } = await supabase.rpc('delete_ticker_content', {
            p_id: id
        });
        if (error) throw error;
        if (data) {
            showNotification('✅ Удалено', 'success');
            loadTickerContent();
        }
    } catch (error) {
        showNotification(`❌ ${error.message}`, 'error');
    }
}

async function refreshAutoContent() {
    const messageDiv = document.getElementById('tickerMessage');
    messageDiv.style.display = 'block';
    messageDiv.style.background = '#667eea';
    messageDiv.style.color = 'white';
    messageDiv.textContent = '🔄 Авто-генерация...';

    try {
        const { data, error } = await supabase.rpc('auto_generate_user_ticker_content');
        if (error) throw error;

        messageDiv.style.background = '#00b894';
        messageDiv.textContent = `✅ Добавлено ${data} автоматических сообщений`;
        setTimeout(() => loadTickerContent(), 1000);
        
    } catch (error) {
        messageDiv.style.background = '#ff4757';
        messageDiv.textContent = `❌ ${error.message}`;
    }
}
