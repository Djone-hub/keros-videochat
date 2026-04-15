// ВРЕМЕННОЕ ИСПРАВЛЕНИЕ: Полностью новый файл с правильным синтаксисом
// Этот файл заменит поврежденный mods-system.js

// Полностью новая версия системы модов с исправленным рейтингом
class ModsManager {
    constructor() {
        this.mods = [];
        this.categories = [];
        this.currentCategory = null;
        this.currentGameVersion = 'fs25';
        this.currentPage = 1;
        this.modsPerPage = 12;
        this.searchQuery = '';
    }

    // Инициализация
    async initialize() {
        try {
            // console.log('🎮 [CLASS] Инициализация ModsManager');
            
            // Загружаем моды
            await this.loadMods();
            
            // console.log('✅ [CLASS] ModsManager успешно инициализирован');
            return true;
        } catch (error) {
            // console.error('❌ [CLASS] Ошибка инициализации ModsManager:', error);
            return false;
        }
    }

    // Загрузка модов
    async loadMods(categoryId = null, gameVersion = null) {
        try {
            // console.log('🎮 [CLASS] Загрузка модов:', categoryId, 'игра:', gameVersion);
            
            let query = window.supabase
                .from('mods')
                .select('*')
                .eq('is_approved', true)
                .order('created_at', { ascending: false });

            // Фильтрация по категории
            if (categoryId && categoryId !== 'all') {
                query = query.eq('category', categoryId);
            }

            // Фильтрация по версии игры
            if (gameVersion) {
                query = query.eq('game_version', gameVersion);
            }

            const { data: mods, error } = await query;
            if (error) throw error;

            this.mods = mods || [];
            // console.log('✅ [CLASS] Моды загружены:', this.mods.length);
            return this.mods;
        } catch (error) {
            // console.error('❌ [CLASS] Ошибка загрузки модов:', error);
            return [];
        }
    }

    // Генерация HTML для деталей мода
    generateModDetailsHTML(mod, userHasRated, userRating, authorUsername, uploaderUsername, allRatings = [], currentRating = null) {
        // Используем актуальный рейтинг из новой системы или fallback на старые данные
        const rating = currentRating ? currentRating.average : (parseFloat(mod.rating) || 0);
        const ratingCount = currentRating ? currentRating.count : (mod.rating_count || 0);
        const fullStars = Math.round(rating);
        
        // Генерируем звёзды рейтинга
        let starsHtml = '';
        for (let i = 1; i <= 5; i++) {
            if (i <= fullStars) {
                starsHtml += '<span style="color: #ff0000; font-size: 28px; font-weight: bold;">★</span>';
            } else {
                starsHtml += '<span style="color: #333333; font-size: 28px;">★</span>';
            }
        }

        // Обработка изображений
        let imagesHtml = '';
        if (mod.images && Array.isArray(mod.images) && mod.images.length > 0) {
            imagesHtml = mod.images.slice(0, 4).map((img, index) => {
                let imgSrc = '';
                if (typeof img === 'object' && img.url) {
                    imgSrc = img.url;
                } else if (typeof img === 'string') {
                    imgSrc = img;
                }
                return `<img src="${imgSrc}" alt="${mod.name}" style="width: 100%; border-radius: 8px; margin-bottom: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.3); object-fit: cover; max-height: 200px;">`;
            }).join('');
            
            if (mod.images.length > 4) {
                imagesHtml += `<div style="text-align: center; color: #00ccff; font-size: 0.8rem; margin-top: 5px;">... и ещё ${mod.images.length - 4} изображений</div>`;
            }
        } else {
            imagesHtml = `<div style="width: 100%; height: 200px; background: rgba(0,204,255,0.1); border: 1px solid rgba(0,204,255,0.3); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #8892b0; flex-direction: column;">
                <div style="font-size: 24px; margin-bottom: 5px;">📷</div>
                <div style="font-size: 12px;">Нет изображений</div>
            </div>`;
        }

        // HTML для системы рейтинга
        let ratingHtml = `
            <div style="margin-top: 1.5rem; padding: 1rem; background: rgba(255,0,0,0.05); border: 2px solid rgba(255,0,0,0.3); border-radius: 12px;">
                <h4 style="color: #ff0000; margin: 0 0 10px 0;">🌟 РЕЙТИНГ МОДА</h4>
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div style="display: flex; gap: 5px;">${starsHtml}</div>
                    <span style="color: #ff0000; font-weight: bold; font-size: 20px;">${rating.toFixed(1)} / 5.0</span>
                    <span style="color: #ff6666; font-size: 1.0rem;">(${ratingCount} оценок)</span>
                </div>
                ${(window.userRole || window.authManager?.currentUser) ? `
                    <div id="user-rating-container" style="margin-top: 10px;">
                        ${userHasRated ?
                            `<span style="color: #ff6666; font-size: 1.0rem;">Вы уже оценили этот мод на ${userRating} звёзд!</span>` :
                            `<span style="color: #ff6666; font-size: 1.0rem;">Оцените мод:</span>`
                        }
                        <div style="display: flex; gap: 5px; margin-top: 5px;" id="rating-stars-${mod.id}">
                            ${[1, 2, 3, 4, 5].map(i => {
                                const isRated = userHasRated && i <= userRating;
                                const starColor = isRated ? '#ff0000' : '#333333';
                                const canInteract = !userHasRated;
                                return `<span onclick="modsManager.rateMod('${mod.id}', ${i})" style="cursor: ${canInteract ? 'pointer' : 'default'}; font-size: 28px; color: ${starColor}; ${!canInteract ? 'pointer-events: none; opacity: 0.7;' : ''} transition: color 0.2s ease;" data-rating="${i}">★</span>`;
                            }).join('')}
                        </div>
                    </div>
                ` : '<div style="margin-top: 10px; color: #ff6666; font-size: 1.0rem;">Для оценки мода необходимо авторизоваться</div>'}
                ${window.userRole && ['admin', 'admin_senior', 'owner', 'moderator_senior'].includes(window.userRole) ? `
                    <div style="margin-top: 10px;">
                        <button onclick="if(confirm('⚠️ Вы уверены, что хотите сбросить рейтинг для мода \\'${mod.name.replace(/'/g, "\\'")}\\'? Все оценки будут удалены.')) { modsManager.resetModRating('${mod.id}'); }" style="background: #ff5722; color: white; border: none; padding: 8px 16px; border-radius: 5px; cursor: pointer; font-size: 0.9rem; margin-top: 5px;">♻️ Сбросить рейтинг</button>
                    </div>
                ` : ''}
                
                ${allRatings && allRatings.length > 0 ? `
                    <div style="margin-top: 1.5rem; padding: 1rem; background: rgba(255,255,0,0.05); border: 1px solid rgba(255,255,0,0.2); border-radius: 8px;">
                        <h5 style="color: #ffd700; margin: 0 0 10px 0;">📊 Все оценки пользователей (${allRatings.length})</h5>
                        <div style="max-height: 200px; overflow-y: auto;">
                            ${allRatings.map(rating => {
                                const userName = rating.profiles?.username || rating.profiles?.email || 'Аноним';
                                const userEmail = rating.profiles?.email;
                                const isCurrentUser = rating.user_id === window.authManager?.currentUser?.id;
                                const stars = '★'.repeat(rating.rating) + '☆'.repeat(5 - rating.rating);
                                
                                return `
                                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; margin-bottom: 5px; background: rgba(0,0,0,0.2); border-radius: 5px; ${isCurrentUser ? 'border: 1px solid #ffd700;' : ''}">
                                        <div>
                                            <div style="color: ${isCurrentUser ? '#ffd700' : '#00ccff'}; font-weight: ${isCurrentUser ? 'bold' : 'normal'};">
                                                ${userName} ${isCurrentUser ? '(вы)' : ''}
                                            </div>
                                            ${userEmail && userEmail !== userName ? `<div style="color: #8892b0; font-size: 0.7rem;">${userEmail}</div>` : ''}
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 10px;">
                                            <span style="color: #ff0000; font-size: 16px;">${stars}</span>
                                            <span style="color: #8892b0; font-size: 0.8rem;">${new Date(rating.created_at).toLocaleString('ru-RU', {
                                        day: 'numeric',
                                        month: 'numeric', 
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}</span>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;


        return `
            <div style="background: linear-gradient(135deg, #1a2f5e, #112240); border: 2px solid #00ccff; border-radius: 15px; padding: 2rem; width: 90%; max-width: 900px; max-height: 90vh; overflow-y: auto; box-shadow: 0 15px 30px rgba(0,0,0,0.4); position: relative; z-index: 200001;">
                ${mod.is_private ? `
                    <!-- VIP статус баннер в самом верху -->
                    <div style="background: linear-gradient(135deg, #ffd700, #ffed4e, #ffd700, #ff9800, #ffd700); background-size: 200% 100%; animation: shimmer 3s ease-in-out infinite; border-radius: 15px; padding: 1.5rem; margin-bottom: 1.5rem; text-align: center; position: relative; overflow: hidden; animation: goldenGlow 2s ease-in-out infinite;">
                        <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(45deg, rgba(255,255,255,0.1) 0%, transparent 50%, rgba(255,255,255,0.1) 100%); pointer-events: none;"></div>
                        <div style="position: relative; z-index: 1;">
                            <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 0.5rem;">
                                <span style="color: #b8860b; font-size: 3rem; text-shadow: 0 0 20px rgba(255, 215, 0, 0.8); animation: pulse 2s infinite;">👑</span>
                                <div style="color: #8b4513; font-size: 2rem; font-weight: bold; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);">VIP МОД</div>
                                <span style="color: #b8860b; font-size: 3rem; text-shadow: 0 0 20px rgba(255, 215, 0, 0.8); animation: pulse 2s infinite;">👑</span>
                            </div>
                            <div style="color: #8b4513; font-size: 1.1rem; font-weight: 600; text-shadow: 1px 1px 2px rgba(0,0,0,0.3);">
                                🌟 Эксклюзивный мод для премиум пользователей 🌟
                            </div>
                        </div>
                    </div>
                ` : ''}

                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid rgba(0,204,255,0.3);">
                    <div>
                        <h3 style="color: ${mod.is_private ? '#ffd700' : '#00ccff'}; margin: 0 0 5px 0; display: flex; align-items: center; gap: 10px; ${mod.is_private ? 'text-shadow: 0 0 15px rgba(255, 215, 0, 0.5);' : ''}">
                            ${mod.name}
                            ${mod.is_private ? '<span style="color: #ffd700; font-size: 1.2rem; text-shadow: 0 0 15px rgba(255, 215, 0, 0.8);">👑</span>' : ''}
                        </h3>
                        <div style="font-size: 0.9rem; color: ${mod.is_approved ? '#4CAF50' : '#ff9800'}; font-weight: bold;">
                            Статус: ${mod.is_approved ? 'Одобрен' : 'На модерации'}
                        </div>
                    </div>
                    <button onclick="this.closest('.mod-modal').remove()" style="background: #f44336; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 16px; z-index: 200002;">&times;</button>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                    <div style="grid-row: 1;">
                        ${imagesHtml}
                    </div>
                    
                    <div style="grid-row: 1;">
                        <div style="background: rgba(0,255,65,0.05); border: 1px solid rgba(0,255,65,0.2); border-radius: 8px; padding: 1rem;">
                            <h4 style="color: #00ccff; margin: 0 0 1rem 0;">📝 Описание</h4>
                            <p style="color: #ccd6f6; margin: 0; line-height: 1.6;">${mod.description || 'Описание отсутствует'}</p>
                            
                            <h4 style="color: #00ccff; margin: 1.5rem 0 1rem 0;">🎮 Версия игры</h4>
                            <p style="color: #4CAF50;">${this.getRussianGameName(mod.game_version) || 'Не указана'}</p>
                            
                            <h4 style="color: #00ccff; margin: 1.5rem 0 1rem 0;">📂 Категория</h4>
                            <p style="color: #ffd700;">${this.getRussianCategoryName(mod.category)}</p>
                            
                            <h4 style="color: #00ccff; margin: 1.5rem 0 1rem 0;">📦 Версия мода</h4>
                            <p style="color: #ff9800;">${mod.mod_version || '1.0.0.0'}</p>
                            
                            <h4 style="color: #00ccff; margin: 1.5rem 0 1rem 0;">📏 Размер файла</h4>
                            <p style="color: #ff9800;">${mod.file_size ? this.formatFileSize(mod.file_size) : 'Не указан'}</p>
                            
                            <h4 style="color: #00ccff; margin: 1.5rem 0 1rem 0;">📊 Скачиваний</h4>
                            <p style="color: #ff9800;">${mod.download_count || 0}</p>
                            
                            <h4 style="color: #00ccff; margin: 1.5rem 0 1rem 0;">📅 Дата добавления</h4>
                            <p style="color: #ff9800;">${new Date(mod.created_at).toLocaleDateString('ru-RU')}</p>
                            
                            ${mod.download_url ? `
                            <h4 style="color: #00ccff; margin: 1.5rem 0 1rem 0;">🔗 Ссылка на скачивание</h4>
                            <p style="color: #4CAF50; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"><a href="${mod.download_url}" target="_blank" style="color: #4CAF50; text-decoration: none; font-weight: bold;">⬇️ Скачать мод</a></p>
                        ` : ''}
                        
                        ${mod.youtube_link ? `
                            <h4 style="color: #00ccff; margin: 1.5rem 0 1rem 0;">🎬 Ссылка на видео YouTube</h4>
                            <p style="color: #ff0000; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"><a href="${mod.youtube_link}" target="_blank" style="color: #ff0000; text-decoration: none; font-weight: bold;">▶️ Смотреть на YouTube</a></p>
                        ` : ''}
                        
                        ${mod.vk_video_link ? `
                            <h4 style="color: #00ccff; margin: 1.5rem 0 1rem 0;">🎬 Ссылка на видео VK</h4>
                            <p style="color: #0077ff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"><a href="${mod.vk_video_link}" target="_blank" style="color: #0077ff; text-decoration: none; font-weight: bold;">🖼️ Смотреть на VK Видео</a></p>
                        ` : ''}
                            
                            <h4 style="color: #00ccff; margin: 1.5rem 0 1rem 0;">👤 Автор мода</h4>
                            <p style="color: #ff9800;">${mod.mod_author || authorUsername}</p>
                            ${mod.owner_id ? `<p style="color: #8892b0; font-size: 0.8rem; margin-top: -5px;">ID: ${mod.owner_id}</p>` : ''}
                            
                            <!-- Отладочная информация -->
                            <div style="background: rgba(255,0,0,0.1); padding: 5px; border-radius: 3px; margin-top: 5px; font-size: 0.7rem; color: #ff6b6b;">
                                🔍 DEBUG: mod_author=${mod.mod_author}, authorUsername=${authorUsername}
                            </div>
                            
                            <h4 style="color: #00ccff; margin: 1.5rem 0 1rem 0;">📤 Залил мод</h4>
                            <p style="color: #00ff41;">${uploaderUsername}</p>
                            ${mod.user_id ? `<p style="color: #8892b0; font-size: 0.8rem; margin-top: -5px;">ID: ${mod.user_id}</p>` : ''}
                            
                            <h4 style="color: #00ccff; margin: 1.5rem 0 1rem 0;">💎 VIP статус</h4>
                            <p style="color: ${mod.is_private ? '#ffd700' : '#4CAF50'}; font-weight: bold;">${mod.is_private ? '👑 VIP мод' : '📦 Обычный мод'}</p>
                            ${ratingHtml}
                        </div>
                    </div>
                </div>

                <div style="text-align: center; margin-top: 2rem; padding-top: 1rem; border-top: 1px solid rgba(0,204,255,0.3);">
                    <button onclick="modsManager.downloadMod('${mod.id}')" style="background: #4CAF50; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: bold; margin-right: 10px;">⬇️ Скачать мод</button>
                    ${window.userRole && ['admin', 'admin_senior', 'owner', 'moderator', 'moderator_senior'].includes(window.userRole) ? `<button onclick="window.editMod('${mod.id}')" style="background: #ff9800; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: bold; margin-right: 10px;">✏️ Редактировать</button>` : ''}
                    ${window.userRole && ['admin', 'admin_senior', 'owner', 'moderator', 'moderator_senior'].includes(window.userRole) ? `<button onclick="if(confirm('⚠️ Удалить мод \\'${mod.name.replace(/'/g, "\\'")}\\'? Это действие необратимо!')) { window.deleteMod('${mod.id}').then(() => this.closest('.mod-modal').remove()); }" style="background: #f44336; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: bold; margin-right: 10px;">🗑️ Удалить мод</button>` : ''}
                    <button onclick="this.closest('.mod-modal').remove()" style="background: #666666; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: bold;">❌ Закрыть</button>
                </div>
                
                <!-- Комментарии во всю ширину -->
                <div style="margin-top: 2rem; padding: 1.5rem; background: rgba(0,204,255,0.05); border: 1px solid rgba(0,204,255,0.2); border-radius: 8px;">
                    <h4 style="color: #00ccff; margin: 0 0 1rem 0;">💬 Комментарии (${mod.comment_count || 0})</h4>
                    <div id="mod-comments-container" style="width: 100%;">
                        <div style="text-align: center; color: #8892b0; padding: 20px;">
                            Пока нет комментариев. Будьте первым!
                        </div>
                    </div>
                    ${window.userRole || window.authManager?.currentUser ? `
                        <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(0,204,255,0.2);">
                            <textarea id="new-comment" placeholder="Оставьте комментарий о моде..." style="width: 100%; padding: 15px; background: rgba(0,0,0,0.3); border: 1px solid rgba(0,204,255,0.3); border-radius: 8px; color: #ffffff; resize: vertical; min-height: 80px; box-sizing: border-box; font-family: 'Courier New', monospace;"></textarea>
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
                                <button onclick="modsManager.addComment('${mod.id}')" style="background: #00ccff; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: bold;">💬 Оставить комментарий</button>
                                ${window.userRole && ['admin', 'admin_senior', 'owner', 'moderator', 'moderator_senior'].includes(window.userRole) ? '<span style="color: #8892b0; font-size: 0.8rem;">Модераторы могут удалять комментарии</span>' : ''}
                            </div>
                        </div>
                    ` : '<div style="margin-top: 1rem; color: #8892b0; font-size: 0.9rem;">Для комментариев необходимо авторизоваться</div>'}
                </div>
            </div>
        `;
    }

    // Получение всех оценок мода
    async getAllRatings(modId) {
        try {
            // console.log('🔍 [getAllRatings] Получение всех оценок для мода:', modId);
            
            const { data: ratings, error } = await window.supabase
                .from('mod_ratings')
                .select('*')
                .eq('mod_id', modId)
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            
            // console.log('✅ [getAllRatings] Получены оценки:', ratings);
            return ratings;
        } catch (error) {
            // console.error('❌ [getAllRatings] Ошибка:', error);
            return [];
        }
    }

    // Добавление оценки пользователя
    async addUserRating(modId, userId, rating) {
        try {
            // console.log('🔍 [addUserRating] Добавление оценки:', modId, userId, rating);
            
            // Проверяем, оценивал ли уже пользователь этот мод
            const { data: existingRating, error: checkError } = await window.supabase
                .from('mod_ratings')
                .select('id')
                .eq('mod_id', modId)
                .eq('user_id', userId)
                .maybeSingle();
            
            if (checkError && checkError.code !== 'PGRST116') {
                throw checkError;
            }
            
            let result;
            if (existingRating) {
                // Обновляем существующую оценку
                const { data, error } = await window.supabase
                    .from('mod_ratings')
                    .update({
                        rating: rating,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existingRating.id)
                    .select()
                    .single();
                
                if (error) throw error;
                result = data;
                // console.log('✅ [addUserRating] Оценка обновлена:', result);
            } else {
                // Добавляем новую оценку
                const { data, error } = await window.supabase
                    .from('mod_ratings')
                    .insert({
                        mod_id: modId,
                        user_id: userId,
                        rating: rating,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    });
                
                if (error) throw error;
                result = data;
                // console.log('✅ [addUserRating] Оценка добавлена:', result);
            }
            
            return {
                success: true,
                message: existingRating ? '✅ Оценка обновлена!' : '✅ Оценка добавлена!',
                rating: rating
            };
        } catch (error) {
            // console.error('❌ [addUserRating] Ошибка:', error);
            return {
                success: false,
                message: '❌ Ошибка при сохранении оценки',
                error: error.message
            };
        }
    }

    // Оценка мода с использованием новой системы рейтинга
    async rateMod(modId, rating) {
        try {
            // console.log('🔍 [CLASS] Начало оценки мода (новая система):', modId, 'оценка:', rating);
            
            if (!window.authManager?.currentUser?.id) {
                this.showNotification('❌ Для оценки мода необходимо авторизоваться', 'error');
                return;
            }

            // Используем встроенную систему рейтинга
            const result = await this.addUserRating(modId, window.authManager.currentUser.id, rating);
            
            if (result.success) {
                // console.log('✅ [CLASS] Оценка успешно добавлена (новая система)');
                this.showNotification(result.message, 'success');
                
                // Получаем актуальные оценки для правильного count и среднего
                const allRatings = await this.getAllRatings(modId);
                
                // Рассчитываем средний рейтинг вручную (триггер не работает)
                const averageRating = allRatings.length > 0 
                    ? allRatings.reduce((sum, r) => sum + r.rating, 0) / allRatings.length 
                    : 0;
                
                // console.log('🔍 [CLASS] Ручной расчет рейтинга:', averageRating, 'из', allRatings.length, 'оценок');
                
                // Обновляем UI с рассчитанными данными
                await this.updateRatingUI(modId, { average: averageRating, count: allRatings.length });
                
                // Принудительно обновляем главный рейтинг в списке
                setTimeout(() => {
                    this.updateMainModRating(modId, averageRating, allRatings.length);
                }, 100);
                
                // Перезагружаем модальное окно для применения оценки
                setTimeout(() => {
                    this.reloadModDetails(modId);
                }, 500);
                
            } else {
                // console.warn('⚠️ [CLASS] Оценка не добавлена:', result.message);
                this.showNotification(result.message, 'warning');
            }

        } catch (error) {
            // console.error('❌ [CLASS] Ошибка оценки мода (новая система):', error);
            this.showNotification('❌ Ошибка при оценке мода: ' + error.message, 'error');
        }
    }

    // Перезагрузка модального окна с деталями мода
    async reloadModDetails(modId) {
        try {
            // console.log('🔄 [CLASS] Перезагрузка модального окна мода:', modId);
            
            // Находим и закрываем текущее модальное окно
            const modal = document.querySelector('.user-details-modal');
            if (modal) {
                modal.remove();
            }
            
            // Небольшая задержка перед открытием нового модального окна
            setTimeout(() => {
                // Используем глобальную функцию showModDetails из script.js (новая верстка)
                if (window.showModDetails) {
                    window.showModDetails(modId);
                } else {
                    console.error('❌ [CLASS] Глобальная функция showModDetails не найдена');
                    this.showNotification('❌ Ошибка при перезагрузке мода', 'error');
                }
            }, 200);
            
        } catch (error) {
            console.error('❌ [CLASS] Ошибка перезагрузки модального окна:', error);
        }
    }

    // Обновление главного рейтинга мода в списке
    updateMainModRating(modId, averageRating, count) {
        try {
            // console.log('🔍 [updateMainModRating] Обновление главного рейтинга:', modId, averageRating, count);
            
            // Находим все карточки мода с этим ID
            const modCards = document.querySelectorAll(`[data-mod-id="${modId}"]`);
            
            modCards.forEach(card => {
                // Находим элементы рейтинга в карточке
                const ratingElement = card.querySelector('.mod-rating');
                const countElement = card.querySelector('.rating-count');
                
                if (ratingElement) {
                    // Обновляем звезды
                    const stars = Math.round(averageRating);
                    let starsHtml = '';
                    for (let i = 1; i <= 5; i++) {
                        starsHtml += `<span style="color: ${i <= stars ? '#ffd700' : '#333'}">★</span>`;
                    }
                    ratingElement.innerHTML = starsHtml;
                }
                
                if (countElement) {
                    // Обновляем количество оценок
                    countElement.textContent = `(${count} оценок)`;
                }
            });
            
            console.log('✅ [updateMainModRating] Главный рейтинг обновлен');
        } catch (error) {
            console.error('❌ [updateMainModRating] Ошибка:', error);
        }
    }

    // Обновление UI рейтинга
    async updateRatingUI(modId, rating) {
        try {
            // console.log('🔍 [CLASS] Обновление UI рейтинга:', modId, rating);
            
            // Получаем все оценки для отображения
            const allRatings = await this.getAllRatings(modId);
            
            // Проверяем, оценивал ли текущий пользователь
            const userRating = allRatings.find(r => r.user_id === window.authManager.currentUser.id);
            const userHasRated = !!userRating;
            const currentUserRatingValue = userRating ? userRating.rating : 0;

            // console.log('🔍 [CLASS] Данные для UI:', {
            //     average: rating.average,
            //     count: rating.count,
            //     userHasRated,
            //     userRating: currentUserRatingValue,
            //     allRatingsCount: allRatings.length
            // });

            // Обновляем блок рейтинга в модальном окне (новая верстка)
            const modal = document.querySelector('.user-details-modal');
            if (modal) {
                // Ищем блок с заголовком "⭐ Рейтинг мода"
                const ratingHeader = Array.from(modal.querySelectorAll('h3')).find(h => 
                    h.textContent.includes('Рейтинг мода')
                );
                
                if (ratingHeader) {
                    const ratingContainer = ratingHeader.nextElementSibling;
                    
                    if (ratingContainer) {
                        // Обновляем средний рейтинг и количество оценок
                        const avgRatingElement = ratingContainer.querySelector('div > div > div:nth-child(2) > div:first-child');
                        const countElement = ratingContainer.querySelector('div > div > div:nth-child(2) > div:last-child');
                        
                        if (avgRatingElement) {
                            avgRatingElement.textContent = rating.average.toFixed(1);
                        }
                        
                        if (countElement) {
                            countElement.textContent = `${rating.count} оценок`;
                        }
                        
                        // Обновляем отображенные звезды
                        const displayedStars = ratingContainer.querySelector('div > div > div:first-child');
                        if (displayedStars) {
                            const stars = displayedStars.querySelectorAll('span');
                            stars.forEach((star, index) => {
                                star.style.color = index < Math.round(rating.average) ? '#ffd700' : '#444';
                            });
                        }
                        
                        // Если пользователь уже оценил, показываем сообщение
                        if (userHasRated) {
                            const ratingSection = ratingContainer.querySelector('div > div:last-child');
                            if (ratingSection) {
                                ratingSection.innerHTML = `<div style="color: #4CAF50; font-weight: bold; font-size: 14px;">Вы уже оценили этот мод на ${currentUserRatingValue} звёзд!</div>`;
                            }
                        }
                        
                        console.log('✅ [CLASS] UI рейтинга обновлен в модальном окне');
                    }
                }
            }
            
            // Обновляем блок рейтинга в модальном окне (старая верстка для совместимости)
            const oldModal = document.querySelector('.mod-modal');
            if (oldModal) {
                // Ищем блок с заголовком "РЕЙТИНГ МОДА"
                const ratingHeader = Array.from(oldModal.querySelectorAll('h4')).find(h => 
                    h.textContent.includes('РЕЙТИНГ МОДА')
                );
                
                if (ratingHeader) {
                    const ratingContainer = ratingHeader.closest('div').parentElement;
                    
                    // Генерируем HTML для звёзд
                    const fullStars = Math.round(rating.average);
                    let starsHtml = '';
                    for (let i = 1; i <= 5; i++) {
                        if (i <= fullStars) {
                            starsHtml += '<span style="color: #ff0000; font-size: 28px; font-weight: bold;">★</span>';
                        } else {
                            starsHtml += '<span style="color: #333333; font-size: 28px;">★</span>';
                        }
                    }

                    // Обновляем HTML рейтинга
                    const newRatingHtml = `
                        <div style="margin-top: 1.5rem; padding: 1rem; background: rgba(255,0,0,0.05); border: 2px solid rgba(255,0,0,0.3); border-radius: 12px;">
                            <h4 style="color: #ff0000; margin: 0 0 10px 0;">🌟 РЕЙТИНГ МОДА</h4>
                            <div style="display: flex; align-items: center; gap: 15px;">
                                <div style="display: flex; gap: 5px;">${starsHtml}</div>
                                <span style="color: #ff0000; font-weight: bold; font-size: 20px;">${rating.average.toFixed(1)} / 5.0</span>
                                <span style="color: #ff6666; font-size: 1.0rem;">(${rating.count} оценок)</span>
                            </div>
                            <div id="user-rating-container" style="margin-top: 10px;">
                                ${userHasRated ?
                                    `<span style="color: #ff6666; font-size: 1.0rem;">Вы уже оценили этот мод на ${currentUserRatingValue} звёзд!</span>` :
                                    `<span style="color: #ff6666; font-size: 1.0rem;">Оцените мод:</span>`
                                }
                                <div style="display: flex; gap: 5px; margin-top: 5px;" id="rating-stars-${modId}">
                                    ${[1, 2, 3, 4, 5].map(i => {
                                        const isRated = userHasRated && i <= currentUserRatingValue;
                                        const starColor = isRated ? '#ff0000' : '#333333';
                                        const canInteract = !userHasRated;
                                        return `<span onclick="modsManager.rateMod('${modId}', ${i})" style="cursor: ${canInteract ? 'pointer' : 'default'}; font-size: 28px; color: ${starColor}; ${!canInteract ? 'pointer-events: none; opacity: 0.7;' : ''} transition: color 0.2s ease;" data-rating="${i}">★</span>`;
                                    }).join('')}
                                </div>
                            </div>
                        </div>
                    `;
                    
                    ratingContainer.innerHTML = newRatingHtml;
                    console.log('✅ [CLASS] Блок рейтинга обновлен (новая система)');
                    
                    // Обновляем главный рейтинг мода в списке
                    this.updateMainModRating(modId, rating.average, allRatings.length);
                    
                    // Обновляем список всех оценок
                    this.updateAllRatingsList(modId, allRatings);
                }
            }

        } catch (error) {
            console.error('❌ [CLASS] Ошибка обновления UI рейтинга:', error);
        }
    }

    // Обновление списка всех оценок
    updateAllRatingsList(modId, allRatings) {
        try {
            // console.log('🔍 [CLASS] Обновление списка всех оценок:', allRatings.length);
            
            const modal = document.querySelector('.mod-modal');
            if (!modal) return;

            // Ищем блок с заголовком "Все оценки пользователей"
            const allRatingsHeader = Array.from(modal.querySelectorAll('h5')).find(h => 
                h.textContent.includes('Все оценки пользователей')
            );
            
            if (allRatingsHeader && allRatings.length > 0) {
                const allRatingsContainer = allRatingsHeader.closest('div').parentElement;
                
                const allRatingsHtml = `
                    <div style="margin-top: 1.5rem; padding: 1rem; background: rgba(255,255,0,0.05); border: 1px solid rgba(255,255,0,0.2); border-radius: 8px;">
                        <h5 style="color: #ffd700; margin: 0 0 10px 0;">📊 Все оценки пользователей (${allRatings.length})</h5>
                        <div style="max-height: 200px; overflow-y: auto;">
                            ${allRatings.map(rating => {
                                const userName = rating.profiles?.username || rating.profiles?.email || 'Аноним';
                                const userEmail = rating.profiles?.email;
                                const isCurrentUser = rating.user_id === window.authManager?.currentUser?.id;
                                const stars = '★'.repeat(rating.rating) + '☆'.repeat(5 - rating.rating);
                                
                                return `
                                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; margin-bottom: 5px; background: rgba(0,0,0,0.2); border-radius: 5px; ${isCurrentUser ? 'border: 1px solid #ffd700;' : ''}">
                                        <div>
                                            <div style="color: ${isCurrentUser ? '#ffd700' : '#00ccff'}; font-weight: ${isCurrentUser ? 'bold' : 'normal'};">
                                                ${userName} ${isCurrentUser ? '(вы)' : ''}
                                            </div>
                                            ${userEmail && userEmail !== userName ? `<div style="color: #8892b0; font-size: 0.7rem;">${userEmail}</div>` : ''}
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 10px;">
                                            <span style="color: #ff0000; font-size: 16px;">${stars}</span>
                                            <span style="color: #8892b0; font-size: 0.8rem;">${new Date(rating.created_at).toLocaleString('ru-RU', {
                                                day: 'numeric',
                                                month: 'numeric', 
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}</span>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
                
                allRatingsContainer.innerHTML = allRatingsHtml;
                console.log('✅ [CLASS] Список всех оценок обновлен');
            }

        } catch (error) {
            console.error('❌ [CLASS] Ошибка обновления списка оценок:', error);
        }
    }

    // Обновление только UI рейтинга без перезагрузки всего модального окна
    async refreshModRatingUI(modId) {
        try {
            // console.log('🔍 [CLASS] Обновление UI рейтинга для мода:', modId);

            // Сначала получаем все оценки
            const { data: ratings, error: ratingsError } = await window.supabase
                .from('mod_ratings')
                .select('*')
                .eq('mod_id', modId)
                .order('created_at', { ascending: false });

            if (ratingsError) {
                console.error('❌ [CLASS] Ошибка получения оценок:', ratingsError);
                return;
            }

            // console.log('🔍 [CLASS] Все оценки из базы:', ratings);
            // console.log('🔍 [CLASS] Количество оценок в базе:', ratings.length);

            // Получаем профили пользователей для оценок
            const userIds = [...new Set(ratings.map(r => r.user_id))];
            let profiles = [];
            
            if (userIds.length > 0) {
                const { data: profilesData } = await window.supabase
                    .from('profiles')
                    .select('id, username, email')
                    .in('id', userIds);
                
                profiles = profilesData || [];
            }

            // Создаем карту профилей для быстрого доступа
            const profileMap = {};
            profiles.forEach(profile => {
                profileMap[profile.id] = profile;
            });

            // Объединяем оценки с профилями
            const allRatings = ratings.map(rating => ({
                ...rating,
                profiles: profileMap[rating.user_id] || { username: 'Аноним', email: '' }
            }));

            // console.log('🔍 [CLASS] Оценки с профилями:', allRatings);

            // Проверяем, оценивал ли текущий пользователь
            const userRating = allRatings.find(r => r.user_id === window.authManager.currentUser.id);
            const userHasRated = !!userRating;
            const currentUserRatingValue = userRating ? userRating.rating : 0;

            // console.log('🔍 [CLASS] Данные текущего пользователя:');
            // console.log('  - Оценил ли:', userHasRated);
            // console.log('  - Оценка:', currentUserRatingValue);

            // Теперь получаем свежие данные мода
            const { data: mod, error: modError } = await window.supabase
                .from('mods')
                .select('*')
                .eq('id', modId)
                .single();

            if (modError || !mod) {
                console.error('❌ [CLASS] Ошибка получения мода:', modError);
                return;
            }

            // console.log('🔍 [CLASS] Свежие данные мода из базы:');
            // console.log('  - ID:', mod.id);
            // console.log('  - Название:', mod.name);
            // console.log('  - Рейтинг:', mod.rating);
            // console.log('  - Количество оценок:', mod.rating_count);
            // console.log('  - Обновлен:', mod.updated_at);

            // Проверяем, актуальны ли данные
            const expectedRatingCount = ratings.length;
            const actualRatingCount = mod.rating_count || 0;
            
            // console.log('🔍 [CLASS] Проверка актуальности данных:');
            // console.log('  - Ожидаемое количество оценок:', expectedRatingCount);
            // console.log('  - Фактическое количество оценок:', actualRatingCount);
            
            if (expectedRatingCount !== actualRatingCount) {
                console.warn('⚠️ [CLASS] Данные не актуальны! Используем данные из таблицы оценок');
                
                // Вычисляем правильный рейтинг из оценок
                const ratingSum = ratings.reduce((sum, r) => sum + r.rating, 0);
                const correctAverageRating = expectedRatingCount > 0 ? ratingSum / expectedRatingCount : 0;
                
                // console.log('🔍 [CLASS] Корректируем данные:');
                // console.log('  - Правильный средний рейтинг:', correctAverageRating);
                // console.log('  - Правильное количество оценок:', expectedRatingCount);
                
                // Используем правильные данные
                mod.rating = correctAverageRating;
                mod.rating_count = expectedRatingCount;
            }

            // Обновляем основной блок рейтинга
            const ratingValue = parseFloat(mod.rating) || 0;
            const fullStars = Math.round(ratingValue);
            
            // console.log('🔍 [CLASS] Расчетные данные для UI:');
            // console.log('  - Средний рейтинг (число):', ratingValue);
            // console.log('  - Средний рейтинг (округленный):', ratingValue.toFixed(1));
            // console.log('  - Количество оценок для UI:', mod.rating_count || 0);
            // console.log('  - Полных звёзд:', fullStars);
            
            let starsHtml = '';
            for (let i = 1; i <= 5; i++) {
                if (i <= fullStars) {
                    starsHtml += '<span style="color: #ff0000; font-size: 28px; font-weight: bold;">★</span>';
                } else {
                    starsHtml += '<span style="color: #333333; font-size: 28px;">★</span>';
                }
            }

            // Находим и обновляем блок рейтинга
            const modal = document.querySelector('.mod-modal');
            // console.log('🔍 [CLASS] Поиск модального окна:', modal);
            
            if (modal) {
                // console.log('🔍 [CLASS] Найдено модальное окно, ищем блок рейтинга...');
                // console.log('🔍 [CLASS] Все h4 в модальном окне:', Array.from(modal.querySelectorAll('h4')).map(h => h.textContent));
                
                // Ищем блок с заголовком "РЕЙТИНГ МОДА"
                const ratingHeader = Array.from(modal.querySelectorAll('h4')).find(h => 
                    h.textContent.includes('РЕЙТИНГ МОДА')
                );
                
                // console.log('🔍 [CLASS] Найденный заголовок рейтинга:', ratingHeader);
                
                if (ratingHeader) {
                    const ratingContainer = ratingHeader.closest('div').parentElement;
                    // console.log('🔍 [CLASS] Контейнер рейтинга:', ratingContainer);
                    // console.log('🔍 [CLASS] HTML контейнера до обновления:', ratingContainer.innerHTML.substring(0, 200) + '...');
                    
                    // Обновляем HTML рейтинга
                    const newRatingHtml = `
                        <div style="margin-top: 1.5rem; padding: 1rem; background: rgba(255,0,0,0.05); border: 2px solid rgba(255,0,0,0.3); border-radius: 12px;">
                            <h4 style="color: #ff0000; margin: 0 0 10px 0;">🌟 РЕЙТИНГ МОДА</h4>
                            <div style="display: flex; align-items: center; gap: 15px;">
                                <div style="display: flex; gap: 5px;">${starsHtml}</div>
                                <span style="color: #ff0000; font-weight: bold; font-size: 20px;">${ratingValue.toFixed(1)} / 5.0</span>
                                <span style="color: #ff6666; font-size: 1.0rem;">(${(mod.rating_count || 0)} оценок)</span>
                            </div>
                            <div id="user-rating-container" style="margin-top: 10px;">
                                ${userHasRated ?
                                    `<span style="color: #ff6666; font-size: 1.0rem;">Вы уже оценили этот мод на ${currentUserRatingValue} звёзд!</span>` :
                                    `<span style="color: #ff6666; font-size: 1.0rem;">Оцените мод:</span>`
                                }
                                <div style="display: flex; gap: 5px; margin-top: 5px;" id="rating-stars-${modId}">
                                    ${[1, 2, 3, 4, 5].map(i => {
                                        const isRated = userHasRated && i <= currentUserRatingValue;
                                        const starColor = isRated ? '#ff0000' : '#333333';
                                        const canInteract = !userHasRated;
                                        return `<span onclick="modsManager.rateMod('${modId}', ${i})" style="cursor: ${canInteract ? 'pointer' : 'default'}; font-size: 28px; color: ${starColor}; ${!canInteract ? 'pointer-events: none; opacity: 0.7;' : ''} transition: color 0.2s ease;" data-rating="${i}">★</span>`;
                                    }).join('')}
                                </div>
                            </div>
                        </div>
                    `;
                    
                    ratingContainer.innerHTML = newRatingHtml;
                    console.log('✅ [CLASS] Блок рейтинга обновлен');
                    console.log('🔍 [CLASS] HTML контейнера после обновления:', ratingContainer.innerHTML.substring(0, 200) + '...');
                    
                    // Повторно инициализируем звёзды
                    this.initializeRatingStars(modId, userHasRated, currentUserRatingValue);
                    
                    // Проверяем, что всё обновилось правильно
                    setTimeout(() => {
                        const updatedHeader = Array.from(modal.querySelectorAll('h4')).find(h => 
                            h.textContent.includes('РЕЙТИНГ МОДА')
                        );
                        if (updatedHeader) {
                            const updatedContainer = updatedHeader.closest('div').parentElement;
                            const updatedText = updatedContainer.querySelector('#user-rating-container span').textContent;
                            console.log('🔍 [CLASS] Проверка после обновления - текст состояния:', updatedText);
                            
                            if (userHasRated && !updatedText.includes('Вы уже оценили')) {
                                console.error('❌ [CLASS] UI не обновился правильно! Используем запасной метод...');
                                this.showModDetails(modId);
                            }
                        }
                    }, 500);
                    
                } else {
                    console.warn('⚠️ [CLASS] Не найден заголовок "РЕЙТИНГ МОДА"');
                    console.log('🔍 [CLASS] Попытка найти по другому селектору...');
                    
                    // Альтернативный поиск - ищем по тексту "Вы уже оценили"
                    const userRatingText = Array.from(modal.querySelectorAll('*')).find(el => 
                        el.textContent.includes('Вы уже оценили') || el.textContent.includes('Оцените мод')
                    );
                    
                    if (userRatingText) {
                        console.log('🔍 [CLASS] Найден текст оценки, ищем родительский блок...');
                        const parentContainer = userRatingText.closest('div').parentElement;
                        console.log('🔍 [CLASS] Родительский контейнер:', parentContainer);
                        
                        if (parentContainer) {
                            parentContainer.innerHTML = newRatingHtml;
                            console.log('✅ [CLASS] Блок рейтинга обновлен через альтернативный метод');
                            this.initializeRatingStars(modId, userHasRated, currentUserRatingValue);
                        }
                    } else {
                        console.error('❌ [CLASS] Не удалось найти блок рейтинга никаким способом');
                        console.log('🔍 [CLASS] Используем запасной метод - полная перезагрузка модального окна');
                        
                        // Запасной метод - полностью перезагружаем модальное окно
                        await this.showModDetails(modId);
                    }
                }
            } else {
                console.warn('⚠️ [CLASS] Не найдено модальное окно');
                console.log('🔍 [CLASS] Все модальные окна:', document.querySelectorAll('.mod-modal'));
                
                // Если модальное окно не найдено, перезагружаем его
                console.log('🔍 [CLASS] Модальное окно не найдено, перезагружаем...');
                await this.showModDetails(modId);
            }

            // Обновляем список всех оценок
            if (allRatings && allRatings.length > 0) {
                const allRatingsHtml = `
                    <div style="margin-top: 1.5rem; padding: 1rem; background: rgba(255,255,0,0.05); border: 1px solid rgba(255,255,0,0.2); border-radius: 8px;">
                        <h5 style="color: #ffd700; margin: 0 0 10px 0;">📊 Все оценки пользователей (${allRatings.length})</h5>
                        <div style="max-height: 200px; overflow-y: auto;">
                            ${allRatings.map(rating => {
                                const userName = rating.profiles?.username || rating.profiles?.email || 'Аноним';
                                const userEmail = rating.profiles?.email;
                                const isCurrentUser = rating.user_id === window.authManager?.currentUser?.id;
                                const stars = '★'.repeat(rating.rating) + '☆'.repeat(5 - rating.rating);
                                
                                return `
                                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; margin-bottom: 5px; background: rgba(0,0,0,0.2); border-radius: 5px; ${isCurrentUser ? 'border: 1px solid #ffd700;' : ''}">
                                        <div>
                                            <div style="color: ${isCurrentUser ? '#ffd700' : '#00ccff'}; font-weight: ${isCurrentUser ? 'bold' : 'normal'};">
                                                ${userName} ${isCurrentUser ? '(вы)' : ''}
                                            </div>
                                            ${userEmail && userEmail !== userName ? `<div style="color: #8892b0; font-size: 0.7rem;">${userEmail}</div>` : ''}
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 10px;">
                                            <span style="color: #ff0000; font-size: 16px;">${stars}</span>
                                            <span style="color: #8892b0; font-size: 0.8rem;">${new Date(rating.created_at).toLocaleString('ru-RU', {
                                                day: 'numeric',
                                                month: 'numeric', 
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}</span>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;

                // Находим и обновляем блок всех оценок
                const allRatingsHeader = Array.from(modal.querySelectorAll('h5')).find(h => 
                    h.textContent.includes('Все оценки пользователей')
                );
                
                if (allRatingsHeader) {
                    const allRatingsContainer = allRatingsHeader.closest('div').parentElement;
                    allRatingsContainer.innerHTML = allRatingsHtml;
                    console.log('✅ [CLASS] Блок всех оценок обновлен');
                } else {
                    // Если блока еще нет, добавляем его в конец модального окна
                    const modalContent = modal.querySelector('div[style*="background: linear-gradient"]');
                    if (modalContent) {
                        modalContent.insertAdjacentHTML('beforeend', allRatingsHtml);
                        console.log('✅ [CLASS] Блок всех оценок добавлен');
                    }
                }
            }

        } catch (error) {
            console.error('❌ [CLASS] Ошибка обновления UI рейтинга:', error);
        }
    }

    // Обновление среднего рейтинга мода
    async updateModRating(modId) {
        try {
            console.log('🔍 [CLASS] Обновление рейтинга мода:', modId);

            // Получаем все оценки мода
            const { data: ratings, error: ratingsError } = await window.supabase
                .from('mod_ratings')
                .select('rating, user_id, created_at')
                .eq('mod_id', modId);

            if (ratingsError) {
                console.error('❌ [CLASS] Ошибка получения оценок:', ratingsError);
                throw ratingsError;
            }

            console.log('🔍 [CLASS] Получены оценки:', ratings);
            console.log('🔍 [CLASS] Детали оценок:');
            ratings.forEach((r, i) => {
                console.log(`  ${i+1}. Пользователь: ${r.user_id}, Оценка: ${r.rating}, Дата: ${r.created_at}`);
            });

            // Вычисляем средний рейтинг
            const ratingSum = ratings.reduce((sum, r) => sum + r.rating, 0);
            const ratingCount = ratings.length;
            const averageRating = ratingCount > 0 ? ratingSum / ratingCount : 0;

            console.log('🔍 [CLASS] Вычисления:');
            console.log('  - Количество оценок:', ratingCount);
            console.log('  - Сумма оценок:', ratingSum);
            console.log('  - Средний рейтинг:', averageRating);
            console.log('  - Средний рейтинг (округленный):', Math.round(averageRating * 10) / 10);

            // Обновляем рейтинг в таблице модов
            const { data: updateResult, error: updateError } = await window.supabase
                .from('mods')
                .update({
                    rating: averageRating,
                    rating_count: ratingCount,
                    updated_at: new Date().toISOString()
                })
                .eq('id', modId)
                .select();

            if (updateError) {
                console.error('❌ [CLASS] Ошибка обновления мода:', updateError);
                throw updateError;
            }

            console.log('✅ [CLASS] Рейтинг мода успешно обновлен:');
            console.log('  - Обновленные данные:', updateResult);

            // Принудительно обновляем данные мода в базе еще раз
            console.log('🔍 [CLASS] Принудительно обновляем данные мода...');
            const { data: refreshedMod, error: refreshError } = await window.supabase
                .from('mods')
                .select('*')
                .eq('id', modId)
                .single();

            if (refreshError) {
                console.error('❌ [CLASS] Ошибка принудительного обновления:', refreshError);
            } else {
                console.log('🔍 [CLASS] Принудительно обновленные данные мода:');
                console.log('  - Рейтинг:', refreshedMod.rating);
                console.log('  - Количество оценок:', refreshedMod.rating_count);
                console.log('  - Обновлен:', refreshedMod.updated_at);
            }

        } catch (error) {
            console.error('❌ [CLASS] Ошибка обновления рейтинга:', error);
            throw error; // Пробрасываем ошибку, чтобы увидеть её в rateMod
        }
    }

    // Скачивание мода
    async downloadMod(modId) {
        try {
            const mod = this.mods.find(m => m.id === modId);
            if (!mod) return;

            // Увеличиваем счетчик скачиваний
            await window.supabase
                .from('mods')
                .update({ download_count: (mod.download_count || 0) + 1 })
                .eq('id', modId);

            // Создаем ссылку для скачивания
            const link = document.createElement('a');
            link.href = mod.download_url;
            link.download = mod.file_name;
            link.click();

            this.showNotification(`Скачивается: ${mod.name}`, 'success');
        } catch (error) {
            console.error('Ошибка скачивания мода:', error);
            this.showNotification('Ошибка скачивания мода', 'error');
        }
    }

    // Показ уведомлений
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 10000;
            background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
            color: white; padding: 15px 20px; border-radius: 5px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease-out;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 3000);
    }

    // Инициализация звёзд рейтинга
    initializeRatingStars(modId, userHasRated, userRating) {
        const container = document.getElementById(`rating-stars-${modId}`);
        if (!container) return;

        const stars = container.querySelectorAll('span[data-rating]');
        
        stars.forEach((star, index) => {
            if (!userHasRated) {
                // Подсветка при наведении
                star.addEventListener('mouseenter', function() {
                    for (let j = 0; j <= index; j++) {
                        stars[j].style.color = '#ff0000';
                    }
                });

                // Возврат к исходному цвету при уходе мыши
                star.addEventListener('mouseleave', function() {
                    for (let j = 0; j < stars.length; j++) {
                        stars[j].style.color = '#333333';
                    }
                });
            }
        });
    }

    // Загрузка комментариев мода
    async loadModComments(modId) {
        try {
            const { data: comments, error } = await window.supabase
                .from('mod_comments')
                .select('*')
                .eq('mod_id', modId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const container = document.getElementById('mod-comments-container');
            if (!container) return;

            if (comments && comments.length > 0) {
                // Загружаем профили пользователей для всех комментариев
                const userIds = [...new Set(comments.map(c => c.user_id))];
                const { data: profiles } = await window.supabase
                    .from('profiles')
                    .select('id, username, email')
                    .in('id', userIds);

                const profileMap = {};
                if (profiles) {
                    profiles.forEach(profile => {
                        profileMap[profile.id] = profile;
                    });
                }

                container.innerHTML = comments.map(comment => {
                    const profile = profileMap[comment.user_id];
                    let displayName = 'Аноним';
                    
                    if (profile) {
                        if (profile.username) {
                            displayName = profile.username;
                        } else if (profile.email) {
                            displayName = profile.email;
                        }
                    } else if (comment.username) {
                        displayName = comment.username;
                    }

                    return `
                        <div style="background: rgba(0,0,0,0.2); border: 1px solid rgba(0,204,255,0.2); border-radius: 8px; padding: 15px; margin-bottom: 10px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <div>
                                    <strong style="color: #00ccff;">${displayName}</strong>
                                    ${profile && profile.username && profile.email ? 
                                        `<div style="color: #8892b0; font-size: 0.7rem; margin-top: 2px;">${profile.email}</div>` : 
                                        ''}
                                </div>
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <span style="color: #8892b0; font-size: 0.8rem;">${new Date(comment.created_at).toLocaleString('ru-RU', {
                                        day: 'numeric',
                                        month: 'numeric', 
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}</span>
                                    ${window.userRole && ['admin', 'admin_senior', 'owner', 'moderator', 'moderator_senior'].includes(window.userRole) ? 
                                        `<button onclick="modsManager.deleteComment('${comment.id}', '${modId}')" style="background: #f44336; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.7rem;">Удалить</button>` : ''}
                                </div>
                            </div>
                            <p style="color: #ccd6f6; margin: 0; line-height: 1.4;">${comment.comment}</p>
                        </div>
                    `;
                }).join('');
            } else {
                container.innerHTML = '<div style="text-align: center; color: #8892b0; padding: 20px;">Пока нет комментариев. Будьте первым!</div>';
            }
        } catch (error) {
            console.error('Ошибка загрузки комментариев:', error);
        }
    }

    // Добавление комментария
    async addComment(modId) {
        try {
            console.log('🔍 [addComment] Начало добавления комментария для мода:', modId);
            
            const textarea = document.getElementById('new-comment');
            console.log('🔍 [addComment] Textarea элемент:', textarea);
            
            if (!textarea) {
                this.showNotification('❌ Не найдено поле для ввода комментария', 'error');
                return;
            }
            
            const content = textarea.value.trim();
            console.log('🔍 [addComment] Содержимое комментария:', content);
            console.log('🔍 [addComment] Длина комментария:', content.length);

            if (!content || content.length === 0) {
                this.showNotification('❌ Комментарий не может быть пустым', 'error');
                return;
            }

            console.log('🔍 [addComment] Проверяем авторизацию...');
            console.log('🔍 [addComment] authManager:', window.authManager);
            console.log('🔍 [addComment] currentUser:', window.authManager?.currentUser);
            console.log('🔍 [addComment] currentUser.id:', window.authManager?.currentUser?.id);
            console.log('🔍 [addComment] currentUser.username:', window.authManager?.currentUser?.username);
            console.log('🔍 [addComment] currentUser.email:', window.authManager?.currentUser?.email);

            if (!window.authManager?.currentUser?.id) {
                this.showNotification('❌ Для добавления комментария необходимо авторизоваться', 'error');
                return;
            }

            // Загружаем актуальные данные профиля пользователя
            let username = 'Аноним';
            try {
                const { data: profile } = await window.supabase
                    .from('profiles')
                    .select('username, email')
                    .eq('id', window.authManager.currentUser.id)
                    .single();
                
                if (profile) {
                    if (profile.username) {
                        username = profile.username;
                    } else if (profile.email) {
                        username = profile.email;
                    }
                }
            } catch (profileError) {
                console.warn('⚠️ [addComment] Ошибка загрузки профиля:', profileError);
                // Используем данные из authManager как запасной вариант
                username = window.authManager.currentUser.username || window.authManager.currentUser.email || 'Аноним';
            }

            // Используем правильное имя колонки - 'comment'
            const commentData = {
                mod_id: modId,
                user_id: window.authManager.currentUser.id,
                username: username,
                comment: content  // Колонка называется 'comment', а не 'content'
            };
            
            console.log('🔍 [addComment] Данные для вставки:', commentData);

            const { data, error } = await window.supabase
                .from('mod_comments')
                .insert(commentData);

            console.log('🔍 [addComment] Результат вставки:');
            console.log('  - data:', data);
            console.log('  - error:', error);

            if (error) {
                console.error('❌ [addComment] Ошибка Supabase:', error);
                throw error;
            }

            console.log('✅ [addComment] Комментарий успешно добавлен');
            textarea.value = '';
            this.showNotification('✅ Комментарий добавлен', 'success');
            
            // Перезагружаем комментарии
            this.loadModComments(modId);

        } catch (error) {
            console.error('❌ [addComment] Ошибка добавления комментария:', error);
            this.showNotification('❌ Ошибка при добавлении комментария: ' + error.message, 'error');
        }
    }

    // Удаление комментария
    async deleteComment(commentId, modId) {
        try {
            if (!confirm('Удалить этот комментарий?')) return;

            const { error } = await window.supabase
                .from('mod_comments')
                .delete()
                .eq('id', commentId);

            if (error) throw error;

            this.showNotification('✅ Комментарий удален', 'success');
            this.loadModComments(modId);

        } catch (error) {
            console.error('Ошибка удаления комментария:', error);
            this.showNotification('❌ Ошибка при удалении комментария', 'error');
        }
    }

    // Сброс рейтинга мода (для модераторов)
    async resetModRating(modId) {
        try {
            console.log('♻️ [resetModRating] Сброс рейтинга для мода:', modId);

            // Удаляем все оценки для этого мода
            const { error: deleteError } = await window.supabase
                .from('mod_ratings')
                .delete()
                .eq('mod_id', modId);

            if (deleteError) throw deleteError;

            // Обновляем мод, сбрасывая рейтинг и количество оценок
            const { error: updateError } = await window.supabase
                .from('mods')
                .update({ rating: 0, rating_count: 0 })
                .eq('id', modId);

            if (updateError) throw updateError;

            this.showNotification('✅ Рейтинг мода сброшен', 'success');
            
            // Обновляем UI
            await this.refreshModRatingUI(modId);

        } catch (error) {
            console.error('Ошибка сброса рейтинга:', error);
            this.showNotification('❌ Ошибка при сбросе рейтинга', 'error');
        }
    }

    // Получение русского названия категории
    getRussianCategoryName(categoryId) {
        const categories = {
            'maps': '🗺️ Карты',
            'tractors': '🚜 Тракторы',
            'combines': '🌾 Комбайны',
            'cars': '🚗 Легковые машины',
            'trucks': '🚛 Грузовики',
            'railway': '🚂 Ж/д транспорт',
            'loaders': '🏗️ Погрузчики и экскаваторы',
            'forestry': '🌲 Лесозаготовка',
            'baling': '📦 Тюковка',
            'plows': '🪒 Плуги',
            'cultivators': '🌱 Культиваторы',
            'mowers': '🌿 Косилки',
            'sprayers': '💧 Опрыскиватели',
            'manure_spreaders': '🚜 Навозоразбрасыватели',
            'farm_implements': '🔧 Сельхоз инвентарь',
            'tools': '🔧 Орудия',
            'animals': '🐄 Животноводство',
            'objects': '🏢 Объекты',
            'buildings': '🏭 Здания',
            'scripts': '⚙️ Скриптинг',
            'textures': '🎨 Текстуры',
            'russian': '🇷🇺 Русские моды',
            'other_mods': '📋 Другие модификации',
            'other': '📦 Прочее'
        };
        return categories[categoryId] || categoryId;
    }

    // Получение полного имени игры на русском языке
    getRussianGameName(gameVersion) {
        const gameMap = {
            'fs19': 'Farming Simulator 19',
            'fs22': 'Farming Simulator 22', 
            'fs25': 'Farming Simulator 25'
        };
        return gameMap[gameVersion] || gameVersion;
    }

    // Форматирование размера файла
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
}

// Создаем экземпляр менеджера модов
const modsManager = new ModsManager();

// Глобальные функции
// window.showModDetails = (modId) => modsManager.showModDetails(modId); // Удалено, используется версия из script.js
window.modsManager = modsManager;
window.rateMod = (modId, rating) => modsManager.rateMod(modId, rating);
window.updateModRating = (modId) => modsManager.updateModRating(modId);
window.refreshModRatingUI = (modId) => modsManager.refreshModRatingUI(modId);
window.initializeRatingStars = (modId, userHasRated, userRating) => modsManager.initializeRatingStars(modId, userHasRated, userRating);
window.resetModRating = (modId) => modsManager.resetModRating(modId);

// Тестовая функция для отладки
window.testModDetails = async function(modId) {
    console.log('🧪 [TEST] Тестовая функция для деталей мода:', modId);
    
    try {
        // Получаем данные мода напрямую
        const { data: mod, error } = await window.supabase
            .from('mods')
            .select('*')
            .eq('id', modId)
            .single();

        console.log('🧪 [TEST] Данные мода:', { mod, error });
        
        if (mod) {
            console.log('🧪 [TEST] owner_id:', mod.owner_id);
            console.log('🧪 [TEST] user_id:', mod.user_id);
            
            // Проверяем профиль
            if (mod.user_id) {
                const { data: profile, error: profileError } = await window.supabase
                    .from('profiles')
                    .select('username, email')
                    .eq('id', mod.user_id)
                    .single();
                
                console.log('🧪 [TEST] Профиль пользователя:', { profile, profileError });
            }
        }
        
        // Вызываем основную функцию
        await window.showModDetails(modId);
        
    } catch (error) {
        console.error('🧪 [TEST] Ошибка:', error);
    }
};

console.log('✅ Новая версия системы модов загружена');
