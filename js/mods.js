function getRussianCategoryName(categoryId) {
    const categoryMap = {
        'Все': 'Все',
        'vip_mods': 'VIP моды',
        'fs19': 'Farming Simulator 19',
        'fs22': 'Farming Simulator 22',
        'fs25': 'Farming Simulator 25',
        'maps': 'Карты',
        'tractors': 'Тракторы',
        'combines': 'Комбайны',
        'trailers': 'Прицепы',
        'trucks': 'Грузовики',
        'cars': 'Легковые автомобили',
        'railway': 'Ж/д транспорт',
        'loaders': 'Погрузчики и экскаваторы',
        'forestry': 'Лесозаготовка',
        'baling': 'Тюковка',
        'plows': 'Плуги',
        'cultivators': 'Культиваторы',
        'mowers': 'Косилки',
        'sprayers': 'Опрыскиватели',
        'manure_spreaders': 'Навозоразбрасыватели',
        'farm_implements': 'Сельхоз инвентарь',
        'tools': 'Орудия',
        'animal_husbandry': '🐄 Животноводство', // Старый ключ из БД
        'equipment': 'Оборудование',
        'buildings': 'Здания',
        'animals': '🐄 Животноводство',
        'objects': 'Объекты',
        'scripts': 'Скрипты',
        'textures': 'Текстуры',
        'scripting': 'Скриптинг',
        'russian_mods': 'Русские моды',
        'russian': 'Русские моды',
        'other_modifications': 'Другие модификации',
        'other': 'Прочее',
        
        // Старые ключи из базы данных для совместимости
        'rail_transport': 'Ж/д транспорт',
        'loaders_excavators': 'Погрузчики и экскаваторы',
        'forestry_equipment': 'Лесозаготовка',
        'baling_equipment': 'Тюковка'
    };
    
    return categoryMap[categoryId] || categoryId;
}

// Полная функция editMod из script.js
window.editMod = window.editMod || async function(modId) {
    console.log('🔧 [editMod] Используем функцию editMod для мода:', modId);
    console.log('🔧 [editMod] window.supabase доступен:', !!window.supabase);

    // Гарантируем доступность функции toggleReserveImagesVisibility
    if (typeof window.toggleReserveImagesVisibility !== 'function') {
        window.toggleReserveImagesVisibility = function() {
            console.warn('⚠️ [toggleReserveImagesVisibility] Функция не полностью загружена');
            const container = document.getElementById('reserveImagesContainer');
            const button = document.getElementById('toggleReserveImages');
            
            if (!container || !button) {
                console.warn('⚠️ [toggleReserveImagesVisibility] Контейнер или кнопка не найдены');
                alert('Элементы интерфейса не найдены. Пожалуйста, обновите страницу.');
                return;
            }
            
            const isVisible = container.style.display !== 'none';
            
            if (isVisible) {
                container.style.display = 'none';
                button.textContent = '👁️ Открыть резервные';
                button.style.background = 'rgba(0,204,255,0.8)';
                console.log('✅ [toggleReserveImagesVisibility] Резервные изображения скрыты');
            } else {
                container.style.display = 'grid';
                button.textContent = '👁️ Скрыть резервные';
                button.style.background = 'rgba(255,165,0,0.8)';
                console.log('✅ [toggleReserveImagesVisibility] Резервные изображения показаны');
            }
        };
        console.log('✅ [editMod] Создана заглушка для toggleReserveImagesVisibility');
    }

    try {
        // Получаем данные мода
        const { data: mod, error } = await window.supabase
            .from('mods')
            .select('*')
            .eq('id', modId)
            .single();

        if (error) throw error;
        if (!mod) {
            console.error('Мод не найден:', modId);
            this.showNotification('❌ Мод не найден!', 'error');
            return;
        }

        // Инициализация изображений - только основные (максимум 4)
        window.editModImages = (mod.images || []).filter(img => img !== null && img !== '').slice(0, 4);
        window.newModImages = []; // Резервные отключены
        
        console.log('🔄 [editMod] Инициализация изображений:', {
            totalImages: mod.images ? mod.images.length : 0,
            mainImages: window.editModImages.length,
            reserveImages: window.newModImages.length,
            allImages: window.editModImages,
            mainImagesArray: window.editModImages,
            rawImages: mod.images
        });

        // Загружаем категории
        const { data: categories } = await window.supabase.from('mod_categories').select('id, name');
        const categoryOptions = categories
            .filter(cat => cat.id !== 'all')
            .map(cat => `<option value="${cat.id}" ${cat.id === mod.category ? 'selected' : ''}>${cat.name || cat.id}</option>`)
            .join('');

        // Создаем модальное окно редактирования
        const modal = document.createElement('div');
        modal.className = 'mod-modal';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(139, 0, 0, 0.9); backdrop-filter: blur(5px);
            display: flex; justify-content: center; align-items: center; z-index: 200000;
        `;

        modal.innerHTML = `
            <div style="background: linear-gradient(135deg, #8B0000, #4B0000); border: 2px solid #ff0000; border-radius: 15px; padding: 2rem; width: 90%; max-width: 600px; max-height: 90vh; overflow-y: auto; box-shadow: 0 0 30px rgba(255,0,0,0.8);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid rgba(255,0,0,0.3);">
                    <h3 style="color: #ff0000; margin: 0;">✏️ Редактирование мода</h3>
                    <button onclick="this.closest('.mod-modal').remove()" style="background: #ff0000; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 16px;">&times;</button>
                </div>
                <form id="editModForm" style="display: grid; gap: 15px;">
                    <div>
                        <label style="display: block; color: #ff0000; margin-bottom: 5px; font-weight: bold;">Название мода:</label>
                        <input type="text" id="editModName" value="${mod.name}" required style="width: 100%; padding: 10px; border: 2px solid rgba(255,0,0,0.3); background: rgba(139,0,0,0.9); border-radius: 8px; color: white; font-size: 14px;">
                    </div>

                    <div>
                        <label style="display: block; color: #ff0000; margin-bottom: 5px; font-weight: bold;">Описание:</label>
                        <textarea id="editModDescription" rows="4" required style="width: 100%; padding: 10px; border: 2px solid rgba(255,0,0,0.3); background: rgba(139,0,0,0.9); border-radius: 8px; color: white; font-size: 14px; resize: vertical;">${mod.description || ''}</textarea>
                    </div>

                    <div>
                        <label style="display: block; color: #ff0000; margin-bottom: 5px; font-weight: bold;">Автор модификации:</label>
                        <input type="text" id="editModAuthor" value="${mod.mod_author || ''}" placeholder="Имя создателя мода" required style="width: 100%; padding: 10px; border: 2px solid rgba(255,0,0,0.3); background: rgba(139,0,0,0.9); border-radius: 8px; color: white; font-size: 14px;">
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div>
                            <label style="display: block; color: #ff0000; margin-bottom: 5px; font-weight: bold;">Категория:</label>
                            <select id="editModCategory" required style="width: 100%; padding: 10px; border: 2px solid rgba(255,0,0,0.3); background: rgba(139,0,0,0.9); border-radius: 8px; color: white; font-size: 14px;">
                                ${categoryOptions}
                            </select>
                        </div>
                        <div>
                            <label style="display: block; color: #ff0000; margin-bottom: 5px; font-weight: bold;">Версия игры:</label>
                            <select id="editModGameVersion" required style="width: 100%; padding: 10px; border: 2px solid rgba(255,0,0,0.3); background: rgba(139,0,0,0.9); border-radius: 8px; color: white; font-size: 14px;">
                                <option value="fs25" ${mod.game_version === 'fs25' ? 'selected' : ''}>FS25</option>
                                <option value="fs22" ${mod.game_version === 'fs22' ? 'selected' : ''}>FS22</option>
                                <option value="fs19" ${mod.game_version === 'fs19' ? 'selected' : ''}>FS19</option>
                            </select>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div>
                            <label style="display: block; color: #ff0000; margin-bottom: 5px; font-weight: bold;">Версия мода:</label>
                            <input type="text" id="editModVersion" value="${mod.mod_version || ''}" placeholder="1.0.0.0" style="width: 100%; padding: 10px; border: 2px solid rgba(255,0,0,0.3); background: rgba(139,0,0,0.9); border-radius: 8px; color: white; font-size: 14px;">
                        </div>
                        <div>
                            <!-- Поле "Размер файла" удалено -->
                        </div>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 15px;">
                        <div>
                            <label style="display: block; color: #ff0000; margin-bottom: 5px; font-weight: bold;">Ссылка на скачивание:</label>
                            <input type="url" id="editDownloadUrl" value="${mod.download_url || ''}" placeholder="https://..." style="width: 100%; padding: 10px; border: 2px solid rgba(255,0,0,0.3); background: rgba(139,0,0,0.9); border-radius: 8px; color: white; font-size: 14px; word-break: break-all;">
                        </div>
                        <div>
                            <label style="display: block; color: #ff0000; margin-bottom: 5px; font-weight: bold;">YouTube:</label>
                            <input type="url" id="editModYoutubeLink" value="${mod.youtube_link || ''}" placeholder="https://youtube.com/watch?v=..." style="width: 100%; padding: 10px; border: 2px solid rgba(255,0,0,0.3); background: rgba(139,0,0,0.9); border-radius: 8px; color: white; font-size: 14px; word-break: break-all;">
                        </div>
                        <div>
                            <label style="display: block; color: #ff0000; margin-bottom: 5px; font-weight: bold;">VK Видео:</label>
                            <input type="url" id="editModVkVideoLink" value="${mod.vk_video_link || ''}" placeholder="https://vk.com/video/..." style="width: 100%; padding: 10px; border: 2px solid rgba(255,0,0,0.3); background: rgba(139,0,0,0.9); border-radius: 8px; color: white; font-size: 14px; word-break: break-all;">
                        </div>
                    </div>

                    <div style="margin-bottom: 15px;">
                        <label style="display: block; color: #ff0000; margin-bottom: 5px; font-weight: bold;"> 📸 Изображения мода (${window.editModImages ? window.editModImages.filter(img => img !== null && img !== '').length : 0}/4):</label>
                        <div style="margin-bottom: 10px; color: #888; font-size: 12px; line-height: 1.3;">
                            Здесь можно редактировать, удалять и менять местами существующие изображения (максимум 4)<br>
                            📏 <b>Рекомендуемый размер:</b> 800x600 - 1920x1080 пикселей<br>
                            💾 <b>Максимальный вес:</b> до 5 МБ на файл<br>
                            🎯 <b>Форматы:</b> JPG, PNG, WebP (PNG - для качества, JPG - для сжатия)
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; justify-content: start; align-items: start;">
                            ${[0, 1, 2, 3].map(i => {
                                // Получаем валидные изображения и проверяем есть ли изображение в этом слоте
                                const validImages = window.editModImages ? window.editModImages.filter(img => img !== null && img !== '') : [];
                                const hasImage = i < validImages.length && validImages[i] && validImages[i] !== null && validImages[i] !== '';
                                const imageUrl = hasImage ? validImages[i] : '';
                                
                                // Отладочный лог для проверки URL
                                console.log(`🖼️ [editMod] Изображение ${i}:`, {
                                    hasImage,
                                    imageUrl,
                                    validImages,
                                    totalImages: validImages.length
                                });
                                
                                const borderColor = hasImage ? 'rgba(0,255,0,0.5)' : 'rgba(255,255,255,0.2)';
                                const backgroundColor = hasImage ? 'rgba(0,255,0,0.1)' : 'rgba(255,255,255,0.05)';
                                const textColor = hasImage ? '#00ff00' : '#ffffff';
                                const icon = hasImage ? '🟢' : '⚪';
                                const statusText = hasImage ? 'Занято' : 'Свободно';
                                const slotNumber = i + 1;
                                 
                                return `
                                    <div style="border: 2px dashed ${borderColor}; border-radius: 8px; padding: 15px; text-align: center; background: ${backgroundColor}; min-height: 250px; display: flex; flex-direction: column; justify-content: space-between;">
                                        <div style="margin-bottom: 10px;">
                                            <div style="font-size: 24px;">${icon}</div>
                                            <div style="font-weight: bold;">Основное ${slotNumber} - ${statusText}</div>
                                        </div>
                                        <input type="file" id="editModMainImage${i}" accept="image/*" style="display: none;" onchange="handleMainImageUpload(${i}, this)">
                                        <label for="editModMainImage${i}" style="cursor: pointer; color: ${textColor}; font-weight: bold;">
                                            📷 Загрузить
                                        </label>
                                        ${hasImage ? `
                                            <div id="mainImagePreview${i}" style="margin-top: 10px; position: relative;">
                                                <img src="${imageUrl}" alt="Предпросмотр" style="width: 100%; max-height: 400px; border-radius: 4px; background: #f0f0f0;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                                                <div style="display: none; padding: 20px; background: #ff0000; color: white; border-radius: 4px;">Ошибка загрузки изображения</div>
                                                <div style="position: absolute; top: 5px; right: 5px; display: flex; gap: 5px; align-items: center;">
                                                    <button type="button" onclick="moveMainImageUp(${i})" style="background: linear-gradient(135deg, #0066cc, #004499); color: white; border: 2px solid #ffffff; border-radius: 6px; cursor: pointer; padding: 8px 14px; font-size: 18px; font-weight: bold; box-shadow: 0 2px 8px rgba(0,0,0,0.8); text-shadow: 1px 1px 2px rgba(0,0,0,0.8); backdrop-filter: blur(2px);">←</button>
                                                    <button type="button" onclick="moveMainImageDown(${i})" style="background: linear-gradient(135deg, #0066cc, #004499); color: white; border: 2px solid #ffffff; border-radius: 6px; cursor: pointer; padding: 8px 14px; font-size: 18px; font-weight: bold; box-shadow: 0 2px 8px rgba(0,0,0,0.8); text-shadow: 1px 1px 2px rgba(0,0,0,0.8); backdrop-filter: blur(2px);">→</button>
                                                    <button type="button" onclick="clearMainImage(${i})" style="background: linear-gradient(135deg, #cc0000, #990000); color: white; border: 2px solid #ffffff; border-radius: 6px; cursor: pointer; padding: 10px 16px; font-size: 20px; font-weight: bold; box-shadow: 0 2px 8px rgba(0,0,0,0.8); text-shadow: 1px 1px 2px rgba(0,0,0,0.8); backdrop-filter: blur(2px);">✕</button>
                                                </div>
                                            </div>
                                        ` : `
                                            <div id="mainImagePreview${i}" style="margin-top: 10px; position: relative; display: none;"></div>
                                        `}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>

                    <div style="display: flex; align-items: center; gap: 10px; background: rgba(255,0,0,0.1); padding: 10px; border-radius: 8px;">
                        <input type="checkbox" id="editIsPrivateMod" ${mod.is_private ? 'checked' : ''}>
                        <label for="editIsPrivateMod" style="color: #ff0000; font-weight: bold;">💎 Приватный мод (VIP)</label>
                    </div>

                    <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 15px;">
                        <button type="button" onclick="this.closest('.mod-modal').remove()" style="background: #757575;">Отмена</button>
                        <button type="submit" style="background: #ff0000; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: bold; margin-right: 10px;">💾 Сохранить</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);

        // Обновляем интерфейс после создания модального окна
        setTimeout(() => {
            console.log('🔄 [editMod] Первоначальное обновление интерфейса');
            updateMainImagesDisplay();
            updateImageCounter();
        }, 100);

        // Обработчик отправки формы
        const editForm = modal.querySelector('#editModForm');
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            try {
                // Собираем все изображения (только основные), фильтруем null и пустые строки
                const allImages = (window.editModImages || [])
                    .filter(img => img !== null && img !== '')
                    .slice(0, 4); // Ограничиваем 4 изображениями
                
                console.log('🔄 [editMod] Сохранение изображений:', {
                    editModImages: window.editModImages,
                    allImages: allImages,
                    totalToSave: allImages.length
                });
                
                const updatedData = {
                    name: document.getElementById('editModName').value,
                    description: document.getElementById('editModDescription').value,
                    mod_author: document.getElementById('editModAuthor').value,
                    category: document.getElementById('editModCategory').value,
                    game_version: document.getElementById('editModGameVersion').value,
                    mod_version: document.getElementById('editModVersion').value,
                    download_url: document.getElementById('editDownloadUrl').value,
                    youtube_link: document.getElementById('editModYoutubeLink').value,
                    vk_video_link: document.getElementById('editModVkVideoLink').value,
                    images: allImages,
                    is_private: document.getElementById('editIsPrivateMod').checked
                };

                // console.log('🔍 [editMod] Сохраняемые данные:', updatedData);
                // console.log('🔍 [editMod] Автор мода:', document.getElementById('editModAuthor').value);

                const { data, error } = await window.supabase
                    .from('mods')
                    .update(updatedData)
                    .eq('id', modId);

                if (error) {
                    console.error('❌ [editMod] Ошибка сохранения:', error);
                    throw error;
                }

                console.log('✅ [editMod] Данные успешно сохранены:', data);

                showNotification('✅ Мод успешно обновлен!', 'success');
                modal.remove();
                
                // Автоматическое обновление интерфейса
                setTimeout(() => {
                    // Обновляем админ-панель если открыта
                    if (typeof window.loadModsForModeration === 'function') {
                        window.loadModsForModeration();
                    }
                    
                    // Обновляем основную страницу модов
                    const activeCategory = document.querySelector('.category-btn.active')?.textContent.trim() || 'Все';
                    const currentGameVersion = document.querySelector('.game-btn.active')?.dataset.game || 'fs25';
                    
                    if (typeof loadModsByCategory === 'function') {
                        loadModsByCategory(activeCategory, currentGameVersion);
                    }
                    
                    // Обновляем открытый модал если он есть
                    const openModal = document.querySelector('.user-details-modal');
                    if (openModal && openModal.querySelector(`[onclick*="${modId}"]`)) {
                        // Закрываем и переоткрываем модал с обновленными данными
                        openModal.remove();
                        if (typeof showModDetails === 'function') {
                            showModDetails(modId);
                        }
                    }
                    
                    console.log('🔄 Интерфейс автоматически обновлен после редактирования мода');
                }, 300);
            } catch (error) {
                console.error('Ошибка сохранения мода:', error);
                showNotification('❌ Ошибка при сохранении мода', 'error');
            }
        });

    } catch (error) {
        console.error('❌ Ошибка при открытии редактирования мода:', error);
        showNotification('❌ Ошибка при открытии редактирования мода', 'error');
    }
}

// Функция для перемещения изображения вверх
window.moveImageUp = function(index) {
    if (index <= 0 || !window.editModImages) return;
    
    // Меняем местами в массиве
    const temp = window.editModImages[index];
    window.editModImages[index] = window.editModImages[index - 1];
    window.editModImages[index - 1] = temp;
    
    // Обновляем отображение с кнопками перемещения
    updateSingleMainImageDisplay(index);
    updateSingleMainImageDisplay(index - 1);
};

// Функция для перемещения изображения вниз
window.moveImageDown = function(index) {
    if (!window.editModImages) return;
    const validImages = window.editModImages.filter(img => img !== null);
    if (index >= validImages.length - 1) return;
    
    // Меняем местами в массиве
    const temp = window.editModImages[index];
    window.editModImages[index] = window.editModImages[index + 1];
    window.editModImages[index + 1] = temp;
    
    // Обновляем отображение с кнопками перемещения
    updateSingleMainImageDisplay(index);
    updateSingleMainImageDisplay(index + 1);
};

// Функции для перемещения резервных изображений
window.moveReserveImageUp = function(index) {
    console.log('🔼 [moveReserveImageUp] Перемещение резервного изображения вверх:', index);
    
    if (!window.newModImages) {
        console.warn('⚠️ [moveReserveImageUp] Массив резервных изображений не найден');
        return;
    }
    
    // Получаем валидные резервные изображения
    const validImages = window.newModImages.filter(img => img !== null && img !== '');
    
    if (index <= 0 || index >= validImages.length) {
        console.log('ℹ️ [moveReserveImageUp] Некорректный индекс или изображение уже вверху');
        return;
    }
    
    // Меняем местами в массиве newModImages
    const temp = window.newModImages[index];
    window.newModImages[index] = window.newModImages[index - 1];
    window.newModImages[index - 1] = temp;
    
    console.log('✅ [moveReserveImageUp] Резервные изображения перемещены');
    
    // Обновляем интерфейс
    updateAllReserveImagesDisplay();
    updateImageCounter();
    
    showNotification('✅ Резервное изображение перемещено вверх', 'success');
};

window.moveReserveImageDown = function(index) {
    console.log('🔽 [moveReserveImageDown] Перемещение резервного изображения вниз:', index);
    
    if (!window.newModImages) {
        console.warn('⚠️ [moveReserveImageDown] Массив резервных изображений не найден');
        return;
    }
    
    // Получаем валидные резервные изображения
    const validImages = window.newModImages.filter(img => img !== null && img !== '');
    
    if (index >= validImages.length - 1 || index < 0) {
        console.log('ℹ️ [moveReserveImageDown] Некорректный индекс или изображение уже внизу');
        return;
    }
    
    // Меняем местами в массиве newModImages
    const temp = window.newModImages[index];
    window.newModImages[index] = window.newModImages[index + 1];
    window.newModImages[index + 1] = temp;
    
    console.log('✅ [moveReserveImageDown] Резервные изображения перемещены');
    
    // Обновляем интерфейс
    updateAllReserveImagesDisplay();
    updateImageCounter();
    
    showNotification('✅ Резервное изображение перемещено вниз', 'success');
};

// Функция для перемещения изображения из резерва в основные
window.moveFromReserveToMain = function(index) {
    console.log('🔄 [moveFromReserveToMain] Перемещение из резерва в основные:', index);
    
    if (!window.editModImages || !window.newModImages) {
        console.warn('⚠️ [moveFromReserveToMain] Массивы изображений не найдены');
        return;
    }
    
    // Получаем валидные изображения
    const validMainImages = window.editModImages.filter(img => img !== null && img !== '');
    const validReserveImages = window.newModImages.filter(img => img !== null && img !== '');
    
    if (index >= validReserveImages.length) {
        console.log('ℹ️ [moveFromReserveToMain] Индекс вне диапазона резервных изображений');
        return;
    }
    
    if (validMainImages.length >= 4) {
        console.log('ℹ️ [moveFromReserveToMain] Основные слоты заполнены');
        showNotification('ℹ️ Основные слоты заполнены', 'error');
        return;
    }
    
    // Получаем изображение из резерва
    const reserveImage = validReserveImages[index];
    
    // Удаляем из резерва
    window.newModImages.splice(index, 1);
    
    // Добавляем в конец основных
    window.editModImages.push(reserveImage);
    
    console.log('✅ [moveFromReserveToMain] Изображение перемещено из резерва в конец основных');
    
    // Обновляем интерфейс
    updateMainImagesDisplay();
    updateAllReserveImagesDisplay();
    updateImageCounter();
    
    showNotification('✅ Изображение перемещено в основные', 'success');
};

// Универсальная функция для обмена Основное ↔ Резерв
window.swapMainWithReserve = function(mainIndex) {
    console.log('🔄 [swapMainWithReserve] Обмен Основное', mainIndex, '↔ Резерв');
    
    if (!window.editModImages || !window.newModImages) {
        console.warn('⚠️ [swapMainWithReserve] Массивы изображений не найдены');
        return;
    }
    
    // Получаем валидные изображения
    const validMainImages = window.editModImages.filter(img => img !== null && img !== '');
    const validReserveImages = window.newModImages.filter(img => img !== null && img !== '');
    
    if (mainIndex >= validMainImages.length || validReserveImages.length === 0) {
        console.log('ℹ️ [swapMainWithReserve] Нет изображений для обмена');
        showNotification('ℹ️ Нет изображений для обмена', 'error');
        return;
    }
    
    // Получаем основное изображение и первое резервное
    const mainImage = validMainImages[mainIndex];
    const reserveImage = validReserveImages[0]; // Всегда берем первое резервное
    
    // Меняем местами
    window.editModImages[mainIndex] = reserveImage;
    window.newModImages[0] = mainImage;
    
    console.log('✅ [swapMainWithReserve] Основное', mainIndex, '↔ Резерв 1 - обмен завершен');
    
    // Обновляем интерфейс
    updateMainImagesDisplay();
    updateAllReserveImagesDisplay();
    updateImageCounter();
    
    showNotification(`✅ Основное ${mainIndex + 1} ↔ Резерв 1`, 'success');
};

// Универсальная функция для обмена Резерв ↔ Основное
window.swapReserveWithMain = function(reserveIndex) {
    console.log('🔄 [swapReserveWithMain] Обмен Резерв', reserveIndex, '↔ Основное');
    
    if (!window.editModImages || !window.newModImages) {
        console.warn('⚠️ [swapReserveWithMain] Массивы изображений не найдены');
        return;
    }
    
    // Получаем валидные изображения
    const validMainImages = window.editModImages.filter(img => img !== null && img !== '');
    const validReserveImages = window.newModImages.filter(img => img !== null && img !== '');
    
    if (reserveIndex >= validReserveImages.length || validMainImages.length === 0) {
        console.log('ℹ️ [swapReserveWithMain] Нет изображений для обмена');
        showNotification('ℹ️ Нет изображений для обмена', 'error');
        return;
    }
    
    // Получаем резервное изображение и последнее основное
    const reserveImage = validReserveImages[reserveIndex];
    const mainImage = validMainImages[validMainImages.length - 1]; // Всегда берем последнее основное
    
    // Меняем местами
    window.newModImages[reserveIndex] = mainImage;
    window.editModImages[validMainImages.length - 1] = reserveImage;
    
    console.log('✅ [swapReserveWithMain] Резерв', reserveIndex, '↔ Основное 4 - обмен завершен');
    
    // Обновляем интерфейс
    updateMainImagesDisplay();
    updateAllReserveImagesDisplay();
    updateImageCounter();
    
    showNotification(`✅ Резерв ${reserveIndex + 1} ↔ Основное 4`, 'success');
};

// Функция для обмена Основное 4 ↔ Резерв 1
window.swapMain4WithReserve1 = function() {
    console.log('🔄 [swapMain4WithReserve1] Обмен Основное 4 ↔ Резерв 1');
    
    if (!window.editModImages || !window.newModImages) {
        console.warn('⚠️ [swapMain4WithReserve1] Массивы изображений не найдены');
        return;
    }
    
    // Получаем валидные изображения
    const validMainImages = window.editModImages.filter(img => img !== null && img !== '');
    const validReserveImages = window.newModImages.filter(img => img !== null && img !== '');
    
    if (validMainImages.length < 4 || validReserveImages.length < 1) {
        console.log('ℹ️ [swapMain4WithReserve1] Нет изображений для обмена');
        showNotification('ℹ️ Нет изображений для обмена', 'error');
        return;
    }
    
    // Получаем Основное 4 и Резерв 1
    const main4 = validMainImages[3]; // Основное 4 (индекс 3)
    const reserve1 = validReserveImages[0]; // Резерв 1 (индекс 0)
    
    // Удаляем Основное 4 и добавляем в начало резервных
    window.editModImages.splice(3, 1); // Удаляем Основное 4
    window.newModImages.unshift(main4); // Добавляем в Резерв 1
    
    // Удаляем Резерв 1 и добавляем в конец основных
    window.newModImages.splice(1, 1); // Удаляем старый Резерв 1 (сдвинутый)
    window.editModImages.push(reserve1); // Добавляем в Основное 4
    
    console.log('✅ [swapMain4WithReserve1] Обмен завершен: Основное 4 → Резерв 1, Резерв 1 → Основное 4');
    
    // Обновляем интерфейс
    updateMainImagesDisplay();
    updateAllReserveImagesDisplay();
    updateImageCounter();
    
    showNotification('✅ Основное 4 → Резерв 1, Резерв 1 → Основное 4', 'success');
};

// Функция для обмена Резерв 1 ↔ Основное 4
window.swapReserve1WithMain4 = function() {
    console.log('🔄 [swapReserve1WithMain4] Обмен Резерв 1 ↔ Основное 4');
    
    if (!window.editModImages || !window.newModImages) {
        console.warn('⚠️ [swapReserve1WithMain4] Массивы изображений не найдены');
        return;
    }
    
    // Получаем валидные изображения
    const validMainImages = window.editModImages.filter(img => img !== null && img !== '');
    const validReserveImages = window.newModImages.filter(img => img !== null && img !== '');
    
    if (validMainImages.length < 1 || validReserveImages.length < 4) {
        console.log('ℹ️ [swapReserve1WithMain4] Нет изображений для обмена');
        showNotification('ℹ️ Нет изображений для обмена', 'error');
        return;
    }
    
    // Получаем Резерв 1 и Основное 4
    const reserve1 = validReserveImages[0]; // Резерв 1 (индекс 0)
    const main4 = validMainImages[validMainImages.length - 1]; // Последнее основное
    
    // Удаляем Резерв 1 и добавляем в конец основных
    window.newModImages.splice(0, 1); // Удаляем Резерв 1
    window.editModImages.push(reserve1); // Добавляем в Основное 4
    
    // Удаляем Основное 4 и добавляем в начало резервных
    window.editModImages.splice(validMainImages.length - 1, 1); // Удаляем Основное 4
    window.newModImages.unshift(main4); // Добавляем в Резерв 1
    
    console.log('✅ [swapReserve1WithMain4] Обмен завершен: Резерв 1 → Основное 4, Основное 4 → Резерв 1');
    
    // Обновляем интерфейс
    updateMainImagesDisplay();
    updateAllReserveImagesDisplay();
    updateImageCounter();
    
    showNotification('✅ Резерв 1 → Основное 4, Основное 4 → Резерв 1', 'success');
};

// Функция для перемещения изображения из основных в резерв
window.moveFromMainToReserve = function(index) {
    console.log('🔄 [moveFromMainToReserve] Перемещение из основных в резерв:', index);
    
    if (!window.editModImages || !window.newModImages) {
        console.warn('⚠️ [moveFromMainToReserve] Массивы изображений не найдены');
        return;
    }
    
    // Получаем валидные изображения
    const validMainImages = window.editModImages.filter(img => img !== null && img !== '');
    const validReserveImages = window.newModImages.filter(img => img !== null && img !== '');
    
    console.log('📊 [moveFromMainToReserve] Состояние:', {
        validMainImages: validMainImages.length,
        validReserveImages: validReserveImages.length,
        totalReserveSlots: 4,
        availableReserveSlots: 4 - validReserveImages.length
    });
    
    if (index >= validMainImages.length) {
        console.log('ℹ️ [moveFromMainToReserve] Индекс вне диапазона основных изображений');
        return;
    }
    
    if (validReserveImages.length >= 4) {
        console.log('ℹ️ [moveFromMainToReserve] Резервные слоты заполнены');
        showNotification('ℹ️ Резервные слоты заполнены', 'error');
        return;
    }
    
    // Получаем изображение из основных
    const mainImage = validMainImages[index];
    
    // Удаляем из основных
    window.editModImages.splice(index, 1);
    
    // Вставляем в начало резервных (сдвигаем остальные)
    window.newModImages.unshift(mainImage);
    
    console.log('✅ [moveFromMainToReserve] Изображение перемещено из основных в начало резерва');
    
    // Обновляем интерфейс
    updateMainImagesDisplay();
    updateAllReserveImagesDisplay();
    updateImageCounter();
    
    showNotification('✅ Изображение перемещено в резерв', 'success');
};

// Функции для перемещения основных изображений
window.moveMainImageUp = function(index) {
    console.log('🔼 [moveMainImageUp] Перемещение изображения вверх:', index);
    
    if (!window.editModImages) {
        console.warn('⚠️ [moveMainImageUp] Массив изображений не найден');
        return;
    }
    
    // Получаем валидные изображения
    const validImages = window.editModImages.filter(img => img !== null && img !== '');
    
    if (index <= 0) {
        console.log('ℹ️ [moveMainImageUp] Изображение уже вверху');
        return;
    }
    
    // Защита от многократных вызовов
    if (window.moveMainImageUp._processing) {
        console.log('ℹ️ [moveMainImageUp] Уже выполняется перемещение');
        return;
    }
    
    window.moveMainImageUp._processing = true;
    
    try {
        // Меняем местами в массиве editModImages
        const temp = window.editModImages[index];
        window.editModImages[index] = window.editModImages[index - 1];
        window.editModImages[index - 1] = temp;
        
        console.log('✅ [moveMainImageUp] Изображения перемещены');
        
        // Обновляем интерфейс
        updateSingleMainImageDisplay(index);
        updateSingleMainImageDisplay(index - 1);
        showNotification('✅ Изображение перемещено вверх', 'success');
    } finally {
        window.moveMainImageUp._processing = false;
    }
};

window.moveMainImageDown = function(index) {
    console.log('🔽 [moveMainImageDown] Перемещение изображения вниз:', index);
    
    if (!window.editModImages) {
        console.warn('⚠️ [moveMainImageDown] Массив изображений не найден');
        return;
    }
    
    const validImages = window.editModImages.filter(img => img !== null);
    if (index >= validImages.length - 1 || index < 0) {
        console.log('ℹ️ [moveMainImageDown] Некорректный индекс или изображение уже внизу');
        return;
    }
    
    // Защита от многократных вызовов
    if (window.moveMainImageDown._processing) {
        console.log('ℹ️ [moveMainImageDown] Уже выполняется перемещение');
        return;
    }
    
    window.moveMainImageDown._processing = true;
    
    try {
        // Меняем местами в массиве editModImages
        const temp = window.editModImages[index];
        window.editModImages[index] = window.editModImages[index + 1];
        window.editModImages[index + 1] = temp;
        
        console.log('✅ [moveMainImageDown] Изображения перемещены');
        
        // Обновляем интерфейс
        updateSingleMainImageDisplay(index);
        updateSingleMainImageDisplay(index + 1);
        showNotification('✅ Изображение перемещено вниз', 'success');
    } finally {
        window.moveMainImageDown._processing = false;
    }
};

// Функция для показа модального окна с ошибкой формата файла
function showFormatErrorModal(format) {
    // Удаляем существующее модальное окно если есть
    const existingModal = document.getElementById('format-error-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Создаем модальное окно
    const modal = document.createElement('div');
    modal.id = 'format-error-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        backdrop-filter: blur(5px);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 99999999;
        opacity: 0;
        transition: opacity 0.3s ease;
    `;
    
    modal.innerHTML = `
        <div style="
            background: linear-gradient(135deg, #1a1a2e, #16213e);
            border: 2px solid #ff4444;
            border-radius: 15px;
            padding: 2rem;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 20px 40px rgba(255, 68, 68, 0.3);
            transform: scale(0.9);
            transition: transform 0.3s ease;
            text-align: center;
        ">
            <div style="
                color: #ff4444;
                font-size: 3rem;
                margin-bottom: 1rem;
                text-shadow: 0 0 10px rgba(255, 68, 68, 0.5);
            ">⚠️</div>
            
            <h2 style="
                color: #ff4444;
                margin: 0 0 1rem 0;
                font-size: 1.5rem;
                text-shadow: 0 0 10px rgba(255, 68, 68, 0.3);
            ">Неподдерживаемый формат изображения</h2>
            
            <p style="
                color: #ffffff;
                margin: 1rem 0;
                font-size: 1.1rem;
                line-height: 1.6;
            ">
                Формат <strong style="color: #ff6666; font-size: 1.2rem;">${format}</strong> не поддерживается Supabase Storage.
            </p>
            
            <div style="
                background: rgba(255, 68, 68, 0.1);
                border: 1px solid rgba(255, 68, 68, 0.3);
                border-radius: 10px;
                padding: 1rem;
                margin: 1.5rem 0;
            ">
                <h3 style="
                    color: #00ff41;
                    margin: 0 0 0.5rem 0;
                    font-size: 1rem;
                ">✅ Поддерживаемые форматы:</h3>
                <div style="
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                    gap: 0.5rem;
                    margin-top: 0.5rem;
                ">
                    <span style="color: #ffffff; background: rgba(0, 255, 65, 0.2); padding: 0.3rem; border-radius: 5px; font-size: 0.9rem;">📸 JPG</span>
                    <span style="color: #ffffff; background: rgba(0, 255, 65, 0.2); padding: 0.3rem; border-radius: 5px; font-size: 0.9rem;">🖼️ PNG</span>
                    <span style="color: #ffffff; background: rgba(0, 255, 65, 0.2); padding: 0.3rem; border-radius: 5px; font-size: 0.9rem;">🎨 WebP</span>
                    <span style="color: #ffffff; background: rgba(0, 255, 65, 0.2); padding: 0.3rem; border-radius: 5px; font-size: 0.9rem;">🎬 GIF</span>
                    <span style="color: #ffffff; background: rgba(0, 255, 65, 0.2); padding: 0.3rem; border-radius: 5px; font-size: 0.9rem;">🎯 SVG</span>
                </div>
            </div>
            
            <button onclick="this.closest('#format-error-modal').remove()" style="
                background: linear-gradient(135deg, #ff4444, #cc0000);
                color: white;
                border: none;
                border-radius: 8px;
                padding: 0.8rem 2rem;
                font-size: 1rem;
                font-weight: bold;
                cursor: pointer;
                margin-top: 1.5rem;
                transition: all 0.3s ease;
                box-shadow: 0 4px 15px rgba(255, 68, 68, 0.3);
            " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                Понятно
            </button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Анимация появления
    setTimeout(() => {
        modal.style.opacity = '1';
        const content = modal.querySelector('div > div');
        if (content) {
            content.style.transform = 'scale(1)';
        }
    }, 10);
    
    // Автоматическое закрытие при клике на фон
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// Функция для обработки основных изображений
window.handleMainImageUpload = async function(index, input) {
    const files = input.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    
    // Проверяем текущее количество изображений
    const existingImagesCount = window.editModImages ? window.editModImages.filter(img => img !== null && img !== '').length : 0;
    
    if (existingImagesCount >= 4) {
        showNotification('❌ Максимальное количество изображений (4 шт) достигнуто! Удалите существующие изображения чтобы добавить новые.', 'error');
        input.value = '';
        return;
    }
    
    // Проверяем размер файла (макс 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showNotification(`❌ Размер файла ${file.name} не должен превышать 5MB`, 'error');
        input.value = '';
        return;
    }
    
    // Проверяем тип файла
    if (!file.type.startsWith('image/')) {
        showNotification(`❌ Файл ${file.name} не является изображением`, 'error');
        input.value = '';
        return;
    }
    
    // Проверяем, что формат поддерживается Supabase
    const extension = file.name.split('.').pop().toLowerCase();
    console.log(`🔍 [handleMainImageUpload] Проверка формата файла: ${file.name}, расширение: ${extension}, MIME тип: ${file.type}`);
    const unsupportedFormats = ['avif', 'heic', 'heif', 'tiff', 'tif', 'raw'];
    if (unsupportedFormats.includes(extension)) {
        console.log(`❌ [handleMainImageUpload] Неподдерживаемый формат обнаружен: ${extension.toUpperCase()}`);
        
        // Показываем модальное окно с ошибкой поверх редактора
        showFormatErrorModal(extension.toUpperCase());
        input.value = '';
        return;
    }
    
    try {
        // Загружаем в Supabase Storage с упрощенным именем
        const timestamp = Date.now();
        const fileExtension = file.name.split('.').pop();
        const fileName = `mod-images/${timestamp}-image.${fileExtension}`;
        console.log('☁️ [handleMainImageUpload] Начинаем загрузку в Supabase:', fileName);
        
        // Проверяем и устанавливаем MIME тип
        let contentType = file.type;
        if (!contentType || contentType === 'application/json') {
            // Определяем MIME тип по расширению файла
            const extension = file.name.split('.').pop().toLowerCase();
            const mimeTypes = {
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'png': 'image/png',
                'gif': 'image/gif',
                'webp': 'image/webp',
                'bmp': 'image/bmp',
                'svg': 'image/svg+xml',
                'jfif': 'image/jpeg'
            };
            contentType = mimeTypes[extension] || 'image/jpeg';
        }
        
        // Используем Supabase SDK для правильной загрузки
        console.log('🚀 [handleMainImageUpload] Загрузка файла:', fileName);
        
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
            try {
                // Проверяем аутентификацию перед загрузкой
                const { data: sessionData } = await window.supabase.auth.getSession();
                
                if (!sessionData.session) {
                    console.error('❌ [handleMainImageUpload] Пользователь не аутентифицирован');
                    throw new Error('Пользователь не аутентифицирован');
                }
                
                // Используем прямой fetch запрос вместо Supabase SDK
                const uploadUrl = `https://gtixajbcfxwqrtsdxnif.supabase.co/storage/v1/object/site-assets/${fileName}`;
                
                const formData = new FormData();
                formData.append('file', file, file.name);
                
                const response = await fetch(uploadUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${sessionData.session.access_token}`,
                        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhhamJjZnh3cXJ0c2R4bmlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1MDUwMTIsImV4cCI6MjA3NjA4MTAxMn0.T3Wvz0UPTG1O4NFS54PzfyB4sJdNLdiGT9GvnvJKGzw'
                    },
                    body: formData
                });
                
                if (!response.ok) {
                    const errorText = await response.text();
                    const error = new Error(`HTTP ${response.status}: ${errorText}`);
                    console.warn(`⚠️ [handleMainImageUpload] Попытка ${retryCount + 1} не удалась:`, error);
                    retryCount++;
                    if (retryCount >= maxRetries) {
                        throw new Error(`Upload failed after ${maxRetries} attempts: ${error.message}`);
                    }
                    // Небольшая задержка перед повторной попыткой
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                }
                
                const data = await response.json();
                const error = null;
                
                console.log('✅ [handleMainImageUpload] Файл успешно загружен в Supabase Storage');
                break;
            } catch (err) {
                console.warn(`⚠️ [handleMainImageUpload] Ошибка попытки ${retryCount + 1}:`, err);
                retryCount++;
                if (retryCount >= maxRetries) {
                    throw err;
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        // Получаем публичный URL
        const { data: { publicUrl } } = window.supabase.storage
            .from('site-assets')
            .getPublicUrl(fileName);
        
        // Используем оригинальный public URL
        const correctedUrl = publicUrl;
        
        // Добавляем в массив основных изображений
        if (!window.editModImages) {
            window.editModImages = [];
        }
        
        window.editModImages.push(correctedUrl);
        
        // Устанавливаем время последней загрузки для защиты от автоматического удаления
        window.lastImageUploadTime = Date.now();
        
        // Обновляем отображение для конкретного слота
        updateSingleMainImageDisplay(index, correctedUrl);
        updateImageCounter();
        
        showNotification('✅ Основное изображение загружено!', 'success');
        
    } catch (error) {
        console.error('❌ [handleMainImageUpload] Ошибка загрузки:', error);
        showNotification('❌ Ошибка при загрузке изображения', 'error');
    } finally {
        input.value = '';
    }
};

// Функции для обработки резервных изображений
window.handleReserveImageUpload = async function(index, input) {
    const files = input.files;
    if (!files || files.length === 0) return;
    
    // Проверяем лимит изображений
    const totalImagesCount = (window.editModImages ? window.editModImages.filter(img => img !== null && img !== '').length : 0) + 
                           (window.newModImages ? window.newModImages.filter(img => img !== null && img !== '').length : 0);
    
    if (totalImagesCount >= 8) {
        showNotification('❌ Лимит изображений достигнут (8/8)', 'error');
        input.value = '';
        return;
    }
    
    const file = files[0];
    
    // Проверяем размер файла (макс 5MB)
    if (file.size > 5 * 1024 * 1024) {
        console.log('❌ [handleReserveImageUpload] Размер файла превышен:', file.name);
        showNotification(`❌ Размер файла ${file.name} не должен превышать 5MB`, 'error');
        input.value = '';
        return;
    }
    
    // Проверяем тип файла
    if (!file.type.startsWith('image/')) {
        console.log('❌ [handleReserveImageUpload] Неверный тип файла:', file.name);
        showNotification(`❌ Файл ${file.name} не является изображением`, 'error');
        input.value = '';
        return;
    }
    
    // Проверяем, что формат поддерживается Supabase
    const extension = file.name.split('.').pop().toLowerCase();
    console.log(`🔍 [handleReserveImageUpload] Проверка формата файла: ${file.name}, расширение: ${extension}, MIME тип: ${file.type}`);
    const unsupportedFormats = ['avif', 'heic', 'heif', 'tiff', 'tif', 'raw'];
    if (unsupportedFormats.includes(extension)) {
        console.log(`❌ [handleReserveImageUpload] Неподдерживаемый формат обнаружен: ${extension.toUpperCase()}`);
        
        // Показываем модальное окно с ошибкой поверх редактора
        showFormatErrorModal(extension.toUpperCase());
        input.value = '';
        return;
    }
    
    try {
        // Загружаем в Supabase Storage с упрощенным именем
        const timestamp = Date.now();
        const fileExtension = file.name.split('.').pop();
        const fileName = `mod-images/${timestamp}-reserve.${fileExtension}`;
        console.log('☁️ [handleReserveImageUpload] Начинаем загрузку в Supabase:', fileName);
        // console.log('🔍 [handleReserveImageUpload] Информация о файле:', {
        //     name: file.name,
        //     type: file.type,
        //     size: file.size
        // });
        
        // Проверяем и устанавливаем MIME тип
        let contentType = file.type;
        if (!contentType || contentType === 'application/json') {
            // Определяем MIME тип по расширению файла
            const extension = file.name.split('.').pop().toLowerCase();
            const mimeTypes = {
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'png': 'image/png',
                'gif': 'image/gif',
                'webp': 'image/webp',
                'bmp': 'image/bmp',
                'svg': 'image/svg+xml',
                'jfif': 'image/jpeg'
            };
            contentType = mimeTypes[extension] || 'image/jpeg';
            console.log('🔧 [handleReserveImageUpload] Установлен MIME тип из расширения:', contentType);
        }
        
        // Используем Supabase SDK для правильной загрузки
        console.log('🚀 [handleReserveImageUpload] Используем прямой fetch для загрузки файла');
        
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
            try {
                // Проверяем аутентификацию перед загрузкой
                const { data: sessionData } = await window.supabase.auth.getSession();
                // console.log('🔍 [handleReserveImageUpload] Текущая сессия:', sessionData.session ? 'Активна' : 'Отсутствует');
                
                if (!sessionData.session) {
                    console.error('❌ [handleReserveImageUpload] Пользователь не аутентифицирован');
                    throw new Error('Пользователь не аутентифицирован');
                }
                
                console.log('🔑 [handleReserveImageUpload] Токен доступа:', sessionData.session.access_token ? 'Присутствует' : 'Отсутствует');
                
                // Явно устанавливаем заголовки для Storage запроса
                const storageOptions = {
                    upsert: true,
                    contentType: contentType,
                    headers: {
                        'Authorization': `Bearer ${sessionData.session.access_token}`,
                        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhhamJjZnh3cXJ0c2R4bmlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1MDUwMTIsImV4cCI6MjA3NjA4MTAxMn0.T3Wvz0UPTG1O4NFS54PzfyB4sJdNLdiGT9GvnvJKGzw'
                    }
                };
                
                console.log('🔧 [handleReserveImageUpload] Опции загрузки:', storageOptions);
                
                // Используем прямой fetch запрос вместо Supabase SDK
                const uploadUrl = `https://gtixajbcfxwqrtsdxnif.supabase.co/storage/v1/object/site-assets/${fileName}`;
                
                const formData = new FormData();
                formData.append('file', file, file.name);
                
                const response = await fetch(uploadUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${sessionData.session.access_token}`,
                        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhhamJjZnh3cXJ0c2R4bmlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1MDUwMTIsImV4cCI6MjA3NjA4MTAxMn0.T3Wvz0UPTG1O4NFS54PzfyB4sJdNLdiGT9GvnvJKGzw'
                    },
                    body: formData
                });
                
                if (!response.ok) {
                    const errorText = await response.text();
                    const error = new Error(`HTTP ${response.status}: ${errorText}`);
                    console.warn(`⚠️ [handleReserveImageUpload] Попытка ${retryCount + 1} не удалась:`, error);
                    retryCount++;
                    if (retryCount >= maxRetries) {
                        throw new Error(`Upload failed after ${maxRetries} attempts: ${error.message}`);
                    }
                    // Небольшая задержка перед повторной попыткой
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                }
                
                const data = await response.json();
                const error = null;
                
                console.log('✅ [handleReserveImageUpload] Файл успешно загружен в Supabase Storage');
                break;
            } catch (err) {
                console.warn(`⚠️ [handleReserveImageUpload] Ошибка попытки ${retryCount + 1}:`, err);
                retryCount++;
                if (retryCount >= maxRetries) {
                    throw err;
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        // Получаем публичный URL
        const { data: { publicUrl } } = window.supabase.storage
            .from('site-assets')
            .getPublicUrl(fileName);
        
        // Используем оригинальный public URL
        const correctedUrl = publicUrl;
        
        // Добавляем в массив резервных изображений
        if (!window.newModImages) {
            window.newModImages = [];
        }
        
        // Находим первый пустой слот или добавляем в конец
        let inserted = false;
        for (let i = 0; i < 4; i++) {
            if (!window.newModImages[i] || window.newModImages[i] === null || window.newModImages[i] === '') {
                window.newModImages[i] = correctedUrl;
                inserted = true;
                console.log('✅ [handleReserveImageUpload] Резервное изображение добавлено в слот', i);
                break;
            }
        }
        
        if (!inserted) {
            console.warn('⚠️ [handleReserveImageUpload] Нет свободных слотов для резервных изображений');
            showNotification('❌ Нет свободных слотов для резервных изображений', 'error');
            return;
        }
        
        // Обновляем интерфейс
        updateAllReserveImagesDisplay();
        updateImageCounter();
        
        showNotification('✅ Резервное изображение загружено!', 'success');
        
    } catch (error) {
        console.error('❌ [handleReserveImageUpload] Ошибка загрузки:', error);
        showNotification('❌ Ошибка при загрузке изображения', 'error');
    } finally {
        input.value = '';
    }
};

// Функция для очистки основного изображения
window.clearMainImage = function(index) {
    console.log('🧹 [clearMainImage] Очистка основного слота:', index);
    
    // Проверяем что это не автоматический вызов при инициализации editMod
    if (window.editModInitializing) {
        console.warn('⚠️ [clearMainImage] Пропускаем очистку во время инициализации editMod');
        return;
    }
    
    // Проверяем что не было недавней загрузки изображения (защита от автоматического удаления)
    const now = Date.now();
    if (window.lastImageUploadTime && (now - window.lastImageUploadTime) < 2000) {
        console.warn('⚠️ [clearMainImage] Пропускаем очистку - было недавнее загрузка изображения');
        return;
    }
    
    if (!window.editModImages) {
        console.warn('⚠️ [clearMainImage] Массив изображений не найден');
        return;
    }
    
    const validImages = window.editModImages ? window.editModImages.filter(img => img !== null && img !== '') : [];
    
    console.log('📊 [clearMainImage] Текущее состояние:', {
        index,
        validImages: validImages.length,
        editModImages: window.editModImages.length,
        imageAtIndex: index < validImages.length ? validImages[index] : 'N/A'
    });
    
    if (index < validImages.length) {
        // Проверяем что изображение существует перед удалением
        if (validImages[index]) {
            // Удаляем изображение из массива
            window.editModImages.splice(index, 1);
            console.log('✅ [clearMainImage] Изображение удалено из позиции', index);
        } else {
            console.warn('⚠️ [clearMainImage] Изображение в позиции', index, 'уже пустое');
        }
    } else {
        console.warn('⚠️ [clearMainImage] Индекс вне диапазона валидных изображений');
    }
    
    // Обновляем интерфейс
    updateMainImagesDisplay();
    updateImageCounter();
    
    showNotification('✅ Основное изображение удалено', 'info');
};

// Функция для очистки резервного изображения
window.clearReserveImage = function(index) {
    console.log('🧹 [clearReserveImage] Очистка резервного слота:', index);
    
    if (!window.newModImages) {
        console.warn('⚠️ [clearReserveImage] Массив резервных изображений не найден');
        return;
    }
    
    // Получаем валидные резервные изображения
    const validImages = window.newModImages.filter(img => img !== null && img !== '');
    
    if (index < validImages.length) {
        // Удаляем изображение из массива
        window.newModImages.splice(index, 1);
        console.log('✅ [clearReserveImage] Резервное изображение удалено из позиции', index);
    } else {
        console.warn('⚠️ [clearReserveImage] Индекс вне диапазона валидных изображений');
    }
    
    // Обновляем интерфейс
    updateAllReserveImagesDisplay();
    updateImageCounter();
    
    showNotification('✅ Резервное изображение удалено', 'info');
};

// Функция обновления отображения основного изображения
window.updateMainImageDisplay = function(index, imageUrl) {
    const container = document.getElementById(`mainImagePreview${index}`);
    const label = document.querySelector(`label[for="editModMainImage${index}"]`);
    const input = document.getElementById(`editModMainImage${index}`);
    
    if (imageUrl) {
        // Показываем изображение
        if (container) {
            container.innerHTML = `
                <img src="${imageUrl}" alt="Предпросмотр" style="width: 100%; height: 80px; object-fit: cover; border-radius: 4px;">
                <button type="button" onclick="clearMainImage(${index})" style="position: absolute; top: 5px; right: 5px; background: linear-gradient(135deg, #cc0000, #990000); color: white; border: 2px solid #ffffff; border-radius: 6px; cursor: pointer; padding: 8px 12px; font-size: 16px; font-weight: bold; box-shadow: 0 2px 8px rgba(0,0,0,0.8); text-shadow: 1px 1px 2px rgba(0,0,0,0.8); backdrop-filter: blur(2px);">✕</button>
            `;
            container.style.display = 'block';
        }
        
        // Обновляем label
        if (label) {
            // Не обновляем текст если он уже установлен в HTML
            // label.innerHTML = `
            //     <div style="font-size: 24px;">🟢</div>
            //     <div>Основное ${index + 1} - Занято</div>
            // `;
            label.style.color = '#00ff00';
            label.style.cursor = 'not-allowed';
        }
        
        // Блокируем input
        if (input) {
            input.removeAttribute('onchange');
        }
    } else {
        // Скрываем изображение
        if (container) {
            container.style.display = 'none';
        }
        
        // Обновляем label
        if (label) {
            // Не обновляем текст если он уже установлен в HTML
            // label.innerHTML = `
            //     <div style="font-size: 24px;">⚪</div>
            //     <div>Основное ${index + 1} - Свободно</div>
            // `;
            label.style.color = '#ffffff';
            label.style.cursor = 'pointer';
        }
        
        // Разблокируем input
        if (input) {
            input.setAttribute('onchange', `handleMainImageUpload(${index}, this)`);
        }
    }
};

// Функция для обновления отображения всех резервных изображений
window.updateAllReserveImagesDisplay = function() {
    console.log('🔄 [updateAllReserveImagesDisplay] Обновление всех резервных слотов');
    console.log('📊 [updateAllReserveImagesDisplay] window.newModImages:', window.newModImages);
    
    // Получаем валидные резервные изображения
    const newImagesCount = window.newModImages ? window.newModImages.filter(img => img !== null && img !== '').length : 0;
    const validReserveImages = window.newModImages ? window.newModImages.filter(img => img !== null && img !== '') : [];
    console.log('📊 [updateAllReserveImagesDisplay] validReserveImages:', validReserveImages);
    
    // Обновляем каждый резервный слот
    [0, 1, 2, 3].forEach(i => {
        const hasImage = i < newImagesCount && window.newModImages[i] && window.newModImages[i] !== null && window.newModImages[i] !== '';
        const imageUrl = hasImage ? window.newModImages[i] : '';
        const container = document.getElementById(`reserveImagePreview${i}`);
        const label = document.querySelector(`label[for="editModReserveImage${i}"]`);
        const input = document.getElementById(`editModReserveImage${i}`);
        
        console.log(`📊 [updateAllReserveImagesDisplay] Резервный слот ${i}:`, {
            hasImage,
            imageUrl: imageUrl.substring(0, 50) + '...',
            container: !!container,
            label: !!label,
            input: !!input,
            containerHTML: container ? container.innerHTML.substring(0, 100) : 'null'
        });
        
        // ПРИНУДИТЕЛЬНОЕ СОЗДАНИЕ КОНТЕЙНЕРА ЕСЛИ ЕГО НЕТ
        if (!container && label && label.parentNode) {
            console.log(`🔧 [updateAllReserveImagesDisplay] Принудительно создаем контейнер для слота ${i}`);
            const newContainer = document.createElement('div');
            newContainer.id = `reserveImagePreview${i}`;
            newContainer.style.cssText = 'margin-top: 5px; position: relative;';
            label.parentNode.insertBefore(newContainer, label.nextSibling);
        }
        
        // Повторно получаем контейнер после создания
        const retryContainer = document.getElementById(`reserveImagePreview${i}`);
        
        if (hasImage && retryContainer) {
            const currentIndex = i;
            const isFirst = currentIndex === 0;
            const isLast = currentIndex === validReserveImages.length - 1;
            const upDisabled = isFirst ? 'disabled style="opacity: 0.5;"' : '';
            const downDisabled = isLast ? 'disabled style="opacity: 0.5;"' : '';
            
            const newHTML = `
                <img src="${imageUrl}" alt="Предпросмотр" style="width: 100%; height: 100px; object-fit: cover; border-radius: 4px;">
                <div style="position: absolute; top: 5px; right: 5px; display: flex; gap: 2px;">
                    <button type="button" onclick="moveFromReserveToMain(${i})" style="background: linear-gradient(135deg, #00cc44, #009933); color: white; border: 2px solid #ffffff; border-radius: 6px; cursor: pointer; padding: 6px 10px; font-size: 14px; font-weight: bold; box-shadow: 0 2px 8px rgba(0,0,0,0.8); text-shadow: 1px 1px 2px rgba(0,0,0,0.8); backdrop-filter: blur(2px);">🔼 В общий</button>
                </div>
                <button type="button" onclick="clearReserveImage(${i})" style="position: absolute; top: 5px; left: 5px; background: linear-gradient(135deg, #cc0000, #990000); color: white; border: 2px solid #ffffff; border-radius: 6px; cursor: pointer; padding: 8px 12px; font-size: 16px; font-weight: bold; box-shadow: 0 2px 8px rgba(0,0,0,0.8); text-shadow: 1px 1px 2px rgba(0,0,0,0.8); backdrop-filter: blur(2px);">✕</button>
            `;
            
            console.log(`🔄 [updateAllReserveImagesDisplay] Устанавливаем HTML для слота ${i}:`, newHTML.substring(0, 100));
            retryContainer.innerHTML = newHTML;
            retryContainer.style.display = 'block';
            console.log(`✅ [updateAllReserveImagesDisplay] Слот ${i} обновлен`);
        } else if (!hasImage && retryContainer) {
            // Скрываем контейнер если нет изображения
            retryContainer.style.display = 'none';
            console.log(`ℹ️ [updateAllReserveImagesDisplay] Слот ${i} скрыт (нет изображения)`);
        } else if (!retryContainer) {
            console.warn(`⚠️ [updateAllReserveImagesDisplay] Контейнер для слота ${i} не найден даже после создания`);
        } else if (hasImage && retryContainer && retryContainer.style.display === 'none') {
            // ПРИНУДИТЕЛЬНО ПОКАЗЫВАЕМ КОНТЕЙНЕР ЕСЛИ ЕГО СКРЫЛИ
            console.log(`🔧 [updateAllReserveImagesDisplay] Принудительно показываем контейнер для слота ${i} (был скрыт)`);
            retryContainer.style.display = 'block';
            
            // Обновляем HTML для контейнера
            const currentIndex = i;
            const isFirst = currentIndex === 0;
            const isLast = currentIndex === validReserveImages.length - 1;
            const upDisabled = isFirst ? 'disabled style="opacity: 0.5;"' : '';
            const downDisabled = isLast ? 'disabled style="opacity: 0.5;"' : '';
            
            const newHTML = `
                <img src="${imageUrl}" alt="Предпросмотр" style="width: 100%; height: 100px; object-fit: cover; border-radius: 4px;">
                <div style="position: absolute; top: 5px; right: 5px; display: flex; gap: 2px;">
                    <button type="button" onclick="moveFromReserveToMain(${i})" style="background: linear-gradient(135deg, #00cc44, #009933); color: white; border: 2px solid #ffffff; border-radius: 6px; cursor: pointer; padding: 6px 10px; font-size: 14px; font-weight: bold; box-shadow: 0 2px 8px rgba(0,0,0,0.8); text-shadow: 1px 1px 2px rgba(0,0,0,0.8); backdrop-filter: blur(2px);">🔼 В общий</button>
                </div>
                <button type="button" onclick="clearReserveImage(${i})" style="position: absolute; top: 5px; left: 5px; background: linear-gradient(135deg, #cc0000, #990000); color: white; border: 2px solid #ffffff; border-radius: 6px; cursor: pointer; padding: 8px 12px; font-size: 16px; font-weight: bold; box-shadow: 0 2px 8px rgba(0,0,0,0.8); text-shadow: 1px 1px 2px rgba(0,0,0,0.8); backdrop-filter: blur(2px);">✕</button>
            `;
            
            retryContainer.innerHTML = newHTML;
            console.log(`✅ [updateAllReserveImagesDisplay] Слот ${i} принудительно показан и обновлен`);
        }
        
        if (hasImage) {
            // Обновляем label
            if (label) {
                label.innerHTML = `
                    <div style="font-size: 24px;">🔴</div>
                    <div>Резерв ${i + 1} - Занято</div>
                `;
                label.style.color = '#ff0000';
                label.style.cursor = 'not-allowed';
            }
            
            // Блокируем input
            if (input) {
                input.removeAttribute('onchange');
            }
        } else {
            // Скрываем изображение
            if (container) {
                container.style.display = 'none';
            }
            
            // Обновляем label
            if (label) {
                label.innerHTML = `
                    <div style="font-size: 24px;">🟡</div>
                    <div>Резерв ${i + 1} - Свободно</div>
                `;
                label.style.color = '#ffcc00';
                label.style.cursor = 'pointer';
            }
            
            // Разблокируем input с проверкой лимита
            if (input) {
                const totalImagesCount = (window.editModImages ? window.editModImages.filter(img => img !== null && img !== '').length : 0) + 
                                       (window.newModImages ? window.newModImages.filter(img => img !== null && img !== '').length : 0);
                
                if (totalImagesCount < 8) {
                    input.setAttribute('onchange', `handleReserveImageUpload(${i}, this)`);
                }
            }
        }
    });
};

// Функция обновления отображения резервного изображения
window.updateReserveImageDisplay = function(index, imageUrl) {
    const container = document.getElementById(`reserveImagePreview${index}`);
    const label = document.querySelector(`label[for="editModReserveImage${index}"]`);
    const input = document.getElementById(`editModReserveImage${index}`);
    
    if (imageUrl) {
        // Показываем изображение
        if (container) {
            container.innerHTML = `
                <img src="${imageUrl}" alt="Предпросмотр" style="width: 100%; height: 100px; object-fit: cover; border-radius: 4px;">
                <div style="position: absolute; top: 5px; right: 5px; display: flex; gap: 2px;">
                    <button type="button" onclick="moveFromReserveToMain(${index})" style="background: linear-gradient(135deg, #00cc44, #009933); color: white; border: 2px solid #ffffff; border-radius: 6px; cursor: pointer; padding: 6px 10px; font-size: 14px; font-weight: bold; box-shadow: 0 2px 8px rgba(0,0,0,0.8); text-shadow: 1px 1px 2px rgba(0,0,0,0.8); backdrop-filter: blur(2px);">🔼 В общий</button>
                </div>
                <button type="button" onclick="clearReserveImage(${index})" style="position: absolute; top: 5px; left: 5px; background: linear-gradient(135deg, #cc0000, #990000); color: white; border: 2px solid #ffffff; border-radius: 6px; cursor: pointer; padding: 8px 12px; font-size: 16px; font-weight: bold; box-shadow: 0 2px 8px rgba(0,0,0,0.8); text-shadow: 1px 1px 2px rgba(0,0,0,0.8); backdrop-filter: blur(2px);">✕</button>
            `;
            container.style.display = 'block';
        }
        
        // Обновляем label
        if (label) {
            label.innerHTML = `
                <div style="font-size: 24px;">🔴</div>
                <div>Резерв ${index + 1} - Занято</div>
            `;
            label.style.color = '#ff0000';
            label.style.cursor = 'not-allowed';
        }
        
        // Блокируем input
        if (input) {
            input.removeAttribute('onchange');
        }
    } else {
        // Скрываем изображение
        if (container) {
            container.style.display = 'none';
        }
        
        // Обновляем label
        if (label) {
            label.innerHTML = `
                <div style="font-size: 24px;">🟡</div>
                <div>Резерв ${index + 1} - Свободно</div>
            `;
            label.style.color = '#ffcc00';
            label.style.cursor = 'pointer';
        }
        
        // Разблокируем input с проверкой лимита
        if (input) {
            const totalImagesCount = (window.editModImages ? window.editModImages.filter(img => img !== null && img !== '').length : 0) + 
                                   (window.newModImages ? window.newModImages.filter(img => img !== null && img !== '').length : 0);
            
            if (totalImagesCount < 8) {
                input.setAttribute('onchange', `handleReserveImageUpload(${index}, this)`);
            }
        }
    }
    // Обновляем резервную секцию если нужно
    updateReserveSectionDisplay();
};

// Функция обновления отображения резервной секции
window.updateReserveSectionDisplay = function() {
    const mainCount = window.editModImages ? window.editModImages.filter(img => img !== null && img !== '').length : 0;
    const reserveCount = window.newModImages ? window.newModImages.filter(img => img !== null && img !== '').length : 0;
    const totalCount = mainCount + reserveCount;
    const remainingSlots = 8 - totalCount;
    
    // Находим резервную секцию
    const reserveLabels = document.querySelectorAll('label');
    const reserveLabel = Array.from(reserveLabels).find(label => 
        label.textContent.includes('Резервные слоты')
    );
    
    if (reserveLabel) {
        // Обновляем текст с количеством
        reserveLabel.innerHTML = `⏳ Резервные слоты (${reserveCount}/4)`;
        
        // Обновляем описание под label
        const description = reserveLabel.parentElement.querySelector('div[style*="margin-bottom: 10px"]');
        if (description) {
            description.innerHTML = `Дополнительные слоты для изображений. Всего загружено: ${totalCount}/8. Можно загрузить: ${remainingSlots}`;
        }
    }
};

// Функция обновления счетчика изображений
window.updateImageCounter = function() {
    const mainCount = window.editModImages ? window.editModImages.filter(img => img !== null && img !== '').length : 0;
    const totalCount = mainCount; // Только основные изображения
    const remainingSlots = 4 - totalCount;
    
    console.log('📊 [updateImageCounter] Обновление счетчика:', {
        main: mainCount,
        total: totalCount,
        remaining: remainingSlots
    });
    
    // Обновляем все счетчики в интерфейсе
    const counters = document.querySelectorAll('[data-image-counter]');
    counters.forEach(counter => {
        counter.textContent = `${totalCount}/4`;
    });
};

// Функция обновления секции с резервом
window.updateReserveSection = function() {
    console.log('🔄 [updateReserveSection] Обновление секции резерва');
    const reserveSection = document.querySelector('div[style*="border-top: 2px dashed rgba(255,0,0,0.3)"]');
    if (!reserveSection) {
        console.log('❌ [updateReserveSection] Секция резерва не найдена');
        return;
    }
    
    const existingImagesCount = window.editModImages ? window.editModImages.filter(img => img !== null && img !== '').length : 0;
    const reserveImagesCount = window.newModImages ? window.newModImages.filter(img => img !== null && img !== '').length : 0;
    const totalImagesCount = existingImagesCount + reserveImagesCount;
    const remainingMainSlots = 4 - existingImagesCount;
    const remainingTotalSlots = 4 - totalImagesCount;
    
    console.log('📊 [updateReserveSection] Состояние:', {
        existingImagesCount,
        reserveImagesCount,
        totalImagesCount,
        remainingMainSlots,
        remainingTotalSlots
    });
    
    // Проверяем, нужно ли переместить изображения из резерва в основные
    // Резервные изображения отключены, поэтому пропускаем этот шаг
    // moveFromReserveToMain();
    
    if (reserveImagesCount > 0) {
        // Резервные изображения отключены, но показываем загруженные если они есть
        reserveSection.innerHTML = `
            <label style="display: block; color: #ff9800; margin-bottom: 5px; font-weight: bold;">⏳ Резервные изображения (${reserveImagesCount}/4):</label>
            <div style="margin-bottom: 10px; color: #ff9800; font-size: 12px;">Резервные изображения отключены. Всего изображений: ${totalImagesCount}/4</div>
            <div style="display: grid; grid-template-columns: 200px 200px; gap: 10px; justify-content: start;">
                ${[0, 1, 2, 3].map(i => {
                    const hasImage = window.newModImages[i] && window.newModImages[i] !== null && window.newModImages[i] !== '';
                    const borderColor = hasImage ? 'rgba(255,152,0,0.5)' : 'rgba(255,204,0,0.3)';
                    const backgroundColor = hasImage ? 'rgba(255,152,0,0.1)' : 'rgba(255,204,0,0.05)';
                    const textColor = hasImage ? '#ff0000' : '#ffcc00';
                    const icon = hasImage ? '🔴' : '🟡';
                    const statusText = hasImage ? 'Занято' : 'Свободно';
                    const slotNumber = i + 1;
                    
                    return `
                        <div style="border: 2px dashed ${borderColor}; border-radius: 8px; padding: 10px; text-align: center; background: ${backgroundColor};">
                            <div style="font-size: 24px;">${icon}</div>
                            <div>Резерв ${slotNumber} - ${statusText}</div>
                            ${hasImage ? `
                                <button type="button" onclick="clearNewImage(${i})" style="margin-top: 5px; background: rgba(255,0,0,0.8); color: white; border: none; border-radius: 4px; cursor: pointer; padding: 4px 8px; font-size: 12px;">🗑️ Удалить</button>
                            ` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    } else {
        if (remainingTotalSlots <= 0) {
            reserveSection.innerHTML = `
                <label style="display: block; color: #ff4444; margin-bottom: 5px; font-weight: bold;">🚫 Лимит изображений достигнут (${totalImagesCount}/4)</label>
                <div style="margin-bottom: 10px; color: #ff4444; font-size: 12px;">Максимальное количество изображений (4 шт) достиглено. Удалите существующие изображения чтобы добавить новые.</div>
                <div style="display: grid; grid-template-columns: 200px 200px; gap: 10px; justify-content: start;">
                    <div style="border: 2px dashed rgba(200,200,200,0.3); border-radius: 8px; padding: 10px; text-align: center; opacity: 0.5;">
                        <div style="font-size: 24px; color: #999;">🚫</div>
                        <div style="color: #999; font-size: 12px;">Лимит достигнут</div>
                        <div style="color: #999; font-size: 10px; margin-top: 5px;">Удалите изображения</div>
                    </div>
                </div>
            `;
        } else {
            // Показываем один загрузочный слот
            reserveSection.innerHTML = `
                <label style="display: block; color: #ff0000; margin-bottom: 5px; font-weight: bold;">➕ Загрузочный слот (до 4 изображений):</label>
                <div style="margin-bottom: 10px; color: #888; font-size: 12px;">Здесь можно загрузить новые изображения. Всего изображений: ${totalImagesCount}/4 (основных: ${existingImagesCount}/4, можно загрузить: ${remainingTotalSlots})</div>
                <div style="display: grid; grid-template-columns: 200px 200px; gap: 10px; justify-content: start;">
                    <div style="border: 2px dashed rgba(255,0,0,0.3); border-radius: 8px; padding: 10px; text-align: center;">
                        <input type="file" id="editModImage0" accept="image/*" style="display: none;" onchange="handleReserveImageUpload(0, this)" multiple>
                        <label for="editModImage0" style="cursor: pointer; color: #ff0000; font-weight: bold;">
                            <div style="font-size: 24px;">📷</div>
                            <div>Загрузить изображения (до 4 шт)</div>
                        </label>
                        <div id="imagePreview0" style="margin-top: 5px; display: none;">
                            <img id="imagePreviewImg0" src="" alt="Предпросмотр" style="width: 100%; height: 100px; object-fit: cover; border-radius: 4px;">
                            <button type="button" onclick="clearNewImage(0)" style="margin-top: 5px; background: rgba(255,0,0,0.8); color: white; border: none; border-radius: 4px; cursor: pointer; padding: 4px 8px; font-size: 12px;">✕</button>
                        </div>
                    </div>
                </div>
            `;
        }
    }
};

// Функция для перемещения изображения из резерва в основные
window.moveFromReserveToMain = function() {
    console.log('🔄 [moveFromReserveToMain] Проверяем перемещение изображений из резерва в основные');
    
    const existingImagesCount = window.editModImages ? window.editModImages.filter(img => img !== null && img !== '').length : 0;
    const reserveImagesCount = window.newModImages ? window.newModImages.filter(img => img !== null && img !== '').length : 0;
    
    console.log('📊 [moveFromReserveToMain] Состояние:', {
        existingImagesCount,
        reserveImagesCount,
        canMove: existingImagesCount < 4 && reserveImagesCount > 0
    });
    
    // Если есть место в основных и есть изображения в резерве
    if (existingImagesCount < 4 && reserveImagesCount > 0) {
        // Находим первое изображение в резерве
        for (let i = 0; i < window.newModImages.length; i++) {
            if (window.newModImages[i] && window.newModImages[i] !== null && window.newModImages[i] !== '') {
                console.log('📦 [moveFromReserveToMain] Перемещаем изображение из резерва', i, 'в основные');
                
                // Перемещаем в основные
                window.editModImages.push(window.newModImages[i]);
                
                // Очищаем резервный слот
                window.newModImages[i] = null;
                
                console.log('📊 [moveFromReserveToMain] После перемещения:', {
                    основных: window.editModImages.filter(img => img !== null && img !== '').length,
                    резервных: window.newModImages.filter(img => img !== null && img !== '').length
                });
                
                // Обновляем интерфейс
                // Обновляем все основные слоты после перемещения из резерва
                [0, 1, 2, 3].forEach(i => {
                    updateSingleMainImageDisplay(i);
                });
                // updateReserveSection(); // УБРАНО - резервные изображения отключены
                
                // Обновляем заголовок основных изображений
                const mainImagesLabel = document.querySelector('label[style*="Основные изображения мода"]');
                if (mainImagesLabel) {
                    const newCount = window.editModImages.filter(img => img !== null && img !== '').length;
                    mainImagesLabel.textContent = `📸 Основные изображения мода (${newCount}/4):`;
                }
                
                showNotification('✅ Изображение перемещено из резерва в основные!', 'success');
                break;
            }
        }
    } else {
        console.log('ℹ️ [moveFromReserveToMain] Перемещение невозможно:', {
            причина: existingImagesCount >= 4 ? 'основные заполнены' : 'нет изображений в резерве',
            основных: existingImagesCount,
            резервных: reserveImagesCount
        });
    }
};

// Функция для удаления изображения
window.removeModImage = function(index) {
    console.log('🗑️ [removeModImage] Удаление изображения с индексом:', index);
    console.log('📊 [removeModImage] До удаления - основных:', window.editModImages ? window.editModImages.filter(img => img !== null).length : 0);
    
    if (!window.editModImages) {
        console.warn('⚠️ [removeModImage] Массив основных изображений не найден');
        return;
    }
    
    // Получаем валидные изображения
    const validMainImages = window.editModImages.filter(img => img !== null && img !== '');
    
    if (index >= validMainImages.length) {
        console.warn('⚠️ [removeModImage] Индекс вне диапазона основных изображений');
        return;
    }
    
    // Удаляем основное изображение
    window.editModImages.splice(index, 1);
    
    console.log('✅ [removeModImage] Основное изображение удалено');
    console.log('📊 [removeModImage] После удаления - основных:', window.editModImages ? window.editModImages.filter(img => img !== null).length : 0);
    
    // Обновляем интерфейс
    updateMainImagesDisplay();
    updateImageCounter();
    
    showNotification('✅ Основное изображение удалено', 'info');
};

// Старая функция handleModImageUpload удалена - заменена на handleMainImageUpload и handleReserveImageUpload

// Функция для обновления одного слота изображения
window.updateSingleMainImageDisplay = function(index, imageUrl = null) {
    console.log(`🔄 [updateSingleMainImageDisplay] Обновление слота ${index}`);
    
    let container = document.getElementById(`mainImagePreview${index}`);
    const label = document.querySelector(`label[for="editModMainImage${index}"]`);
    const input = document.getElementById(`editModMainImage${index}`);
    
    // Если контейнер не существует, создаем его
    if (!container && label && label.parentNode) {
        console.log(`🔧 [updateSingleMainImageDisplay] Создаю контейнер для слота ${index}`);
        container = document.createElement('div');
        container.id = `mainImagePreview${index}`;
        container.style.cssText = 'margin-top: 10px; position: relative;';
        label.parentNode.insertBefore(container, label.nextSibling);
    }
    
    if (!container || !label || !input) {
        console.warn(`⚠️ [updateSingleMainImageDisplay] Элементы для слота ${index} не найдены`);
        console.log(`🔍 [updateSingleMainImageDisplay] Проверка:`, {
            container: !!container,
            label: !!label,
            input: !!input,
            containerId: `mainImagePreview${index}`
        });
        return;
    }
    
    // Если передан конкретный URL, используем его
    let hasImage = false;
    let displayUrl = '';
    
    if (imageUrl) {
        hasImage = true;
        displayUrl = imageUrl;
        console.log(`🔄 [updateSingleMainImageDisplay] Используем переданный URL: ${imageUrl.substring(0, 50)}...`);
    } else {
        // Иначе ищем изображение в массиве по индексу
        const validImages = window.editModImages ? window.editModImages.filter(img => img !== null && img !== '') : [];
        hasImage = index < validImages.length && validImages[index] && validImages[index] !== null && validImages[index] !== '';
        displayUrl = hasImage ? validImages[index] : '';
        console.log(`🔄 [updateSingleMainImageDisplay] Слот ${index}:`, {
            hasImage,
            imageUrl: displayUrl.substring(0, 50) + '...',
            validImages,
            totalImages: validImages.length
        });
    }
    
    if (hasImage) {
        // Используем img тег вместо backgroundImage для лучшей совместимости
        try {
            container.style.border = '2px solid #4fc3f7';
            container.style.borderRadius = '8px';
            container.style.display = 'flex';
            container.style.alignItems = 'center';
            container.style.justifyContent = 'center';
            container.style.position = 'relative';
            container.style.overflow = 'hidden';
            container.style.minHeight = '120px';
            container.style.cursor = 'pointer';
            container.style.visibility = 'visible';
            container.style.opacity = '1';
            container.style.zIndex = '1000';
            container.style.background = '#f0f0f0';
            
            // Добавляем img элемент и кнопки управления
            const currentIndex = index;
            const isFirst = currentIndex === 0;
            const isLast = currentIndex === (window.editModImages ? window.editModImages.filter(img => img !== null && img !== '').length : 0) - 1;
            const upDisabled = isFirst ? 'disabled style="opacity: 0.5;"' : '';
            const downDisabled = isLast ? 'disabled style="opacity: 0.5;"' : '';
            
            container.innerHTML = `
                <img src="${displayUrl}" alt="Предпросмотр" style="max-width: 100%; max-height: 200px; object-fit: cover; border-radius: 4px;" crossorigin="anonymous" onerror="console.error('Ошибка загрузки изображения:', this.src); this.style.display='none'; this.parentElement.innerHTML='<div style=\\'padding: 20px; background: #ff0000; color: white; border-radius: 4px;\\'>Ошибка загрузки изображения<br>URL: ' + this.src + '</div>';" onload="console.log('Изображение успешно загружено:', this.src);">
                <div style="position: absolute; top: 5px; right: 5px; display: flex; gap: 5px; align-items: center;">
                    <button type="button" onclick="moveMainImageUp(${index})" ${upDisabled} style="background: linear-gradient(135deg, #0066cc, #004499); color: white; border: 2px solid #ffffff; border-radius: 6px; cursor: pointer; padding: 8px 14px; font-size: 18px; font-weight: bold; box-shadow: 0 2px 8px rgba(0,0,0,0.8); text-shadow: 1px 1px 2px rgba(0,0,0,0.8); backdrop-filter: blur(2px);">←</button>
                    <button type="button" onclick="moveMainImageDown(${index})" ${downDisabled} style="background: linear-gradient(135deg, #0066cc, #004499); color: white; border: 2px solid #ffffff; border-radius: 6px; cursor: pointer; padding: 8px 14px; font-size: 18px; font-weight: bold; box-shadow: 0 2px 8px rgba(0,0,0,0.8); text-shadow: 1px 1px 2px rgba(0,0,0,0.8); backdrop-filter: blur(2px);">→</button>
                    <button type="button" onclick="clearMainImage(${index})" style="background: linear-gradient(135deg, #cc0000, #990000); color: white; border: 2px solid #ffffff; border-radius: 6px; cursor: pointer; padding: 10px 16px; font-size: 20px; font-weight: bold; box-shadow: 0 2px 8px rgba(0,0,0,0.8); text-shadow: 1px 1px 2px rgba(0,0,0,0.8); backdrop-filter: blur(2px);">✕</button>
                </div>
            `;
            
            console.log(`✅ [updateSingleMainImageDisplay] Изображение установлено через img тег в контейнер ${index}`);
            console.log(`🔍 [updateSingleMainImageDisplay] URL изображения:`, displayUrl);
            console.log(`🔍 [updateSingleMainImageDisplay] Стили контейнера:`, {
                display: container.style.display,
                visibility: container.style.visibility,
                opacity: container.style.opacity,
                offsetWidth: container.offsetWidth,
                offsetHeight: container.offsetHeight
            });
        } catch (error) {
            console.error('❌ [updateSingleMainImageDisplay] Ошибка установки стилей:', error);
        }
    } else {
        // Скрываем контейнер если нет изображения
        container.innerHTML = '';
        container.style.display = 'none';
        console.log(`🔄 [updateSingleMainImageDisplay] Контейнер ${index} скрыт - нет изображения`);
    }
};

// Функция для обновления отображения основных изображений
window.updateMainImagesDisplay = function() {
    console.log('🔄 [updateMainImagesDisplay] Обновление отображения основных изображений');
    
    // Получаем валидные изображения
    const validImages = window.editModImages ? window.editModImages.filter(img => img !== null && img !== '') : [];
    
    // Обновляем каждый основной слот
    [0, 1, 2, 3].forEach(i => {
        const hasImage = i < validImages.length && validImages[i] && validImages[i] !== null && validImages[i] !== '';
        const imageUrl = hasImage ? validImages[i] : '';
        const container = document.getElementById(`mainImagePreview${i}`);
        const label = document.querySelector(`label[for="editModMainImage${i}"]`);
        const input = document.getElementById(`editModMainImage${i}`);
        
        console.log(`📊 [updateMainImagesDisplay] Слот ${i}:`, {
            hasImage,
            imageUrl: imageUrl.substring(0, 50) + '...',
            container: !!container,
            label: !!label,
            input: !!input
        });
        
        if (hasImage) {
            // Показываем изображение
            if (container) {
                const currentIndex = i;
                const isFirst = currentIndex === 0;
                const isLast = currentIndex === validImages.length - 1;
                const upDisabled = isFirst ? 'disabled style="opacity: 0.5;"' : '';
                const downDisabled = isLast ? 'disabled style="opacity: 0.5;"' : '';
                
                try {
                    container.style.backgroundImage = `url('${imageUrl}')`;
                    container.style.backgroundSize = 'cover';
                    container.style.backgroundPosition = 'center';
                    container.style.backgroundRepeat = 'no-repeat';
                    container.style.border = '2px solid #4fc3f7';
                    container.style.borderRadius = '8px';
                    container.style.display = 'flex';
                    container.style.alignItems = 'center';
                    container.style.justifyContent = 'center';
                    container.style.position = 'relative';
                    container.style.overflow = 'hidden';
                    container.style.minHeight = '120px';
                    container.style.cursor = 'pointer';
                } catch (error) {
                    console.error('❌ Ошибка установки стилей для контейнера изображения:', error);
                }
            }
            
            // Обновляем label
            if (label) {
                // Не обновляем текст если он уже установлен в HTML
                // label.innerHTML = `
                //     <div style="font-size: 24px;">🟢</div>
                //     <div>Основное ${i + 1} - Занято</div>
                // `;
                label.style.color = '#00ff00';
                label.style.cursor = 'not-allowed';
            }
            
            // Блокируем input
            if (input) {
                input.removeAttribute('onchange');
            }
        } else {
            // Скрываем изображение
            if (container) {
                container.style.display = 'none';
            }
            
            // Обновляем label
            if (label) {
                // Не обновляем текст если он уже установлен в HTML
                // label.innerHTML = `
                //     <div style="font-size: 24px;">⚪</div>
                //     <div>Основное ${i + 1} - Свободно</div>
                // `;
                label.style.color = '#ffffff';
                label.style.cursor = 'pointer';
            }
            
            // Разблокируем input
            if (input) {
                input.setAttribute('onchange', `handleMainImageUpload(${i}, this)`);
            }
        }
    });
};

// Функция-заглушка для обратной совместимости
window.clearNewImage = function(index) {
    console.log('🔄 [clearNewImage] Вызов устаревшей функции для индекса:', index);
    
    // Проверяем есть ли изображение в основных слотах
    if (window.editModImages && window.editModImages[index] && window.editModImages[index] !== null && window.editModImages[index] !== '') {
        // Удаляем основное изображение
        window.editModImages.splice(index, 1);
        console.log('✅ [clearNewImage] Основное изображение удалено из слота', index);
        
        // Обновляем интерфейс
        if (window.updateMainImagesDisplay) {
            window.updateMainImagesDisplay();
        }
        if (window.updateImageCounter) {
            window.updateImageCounter();
        }
        
        // Показываем уведомление
        if (window.showNotification) {
            window.showNotification('✅ Основное изображение удалено', 'info');
        }
    } else {
        console.warn('⚠️ [clearNewImage] Изображение не найдено в слоте', index);
    }
};

// Функция для обновления отображения изображений в редакторе модов
window.updateModImagesDisplay = function() {
    const container = document.getElementById('editModImagesContainer');
    if (!container) return;
    
    const validImages = window.editModImages ? window.editModImages.filter(img => img !== null) : [];
    
    const html = validImages.map((img, index) => {
        let imgSrc = '';
        if (typeof img === 'object' && img.url) {
            imgSrc = img.url;
        } else if (typeof img === 'string') {
            imgSrc = img;
        }
        const originalIndex = window.editModImages ? window.editModImages.findIndex(originalImg => originalImg === img) : -1;
        const isLast = index === validImages.length - 1;
        const isFirst = index === 0;
        const upDisabled = isFirst ? 'disabled style="opacity: 0.5;"' : '';
        const downDisabled = isLast ? 'disabled style="opacity: 0.5;"' : '';
        
        return `
            <div style="position: relative; border: 2px solid rgba(255,0,0,0.3); border-radius: 8px; overflow: hidden;">
                <img src="${imgSrc}" alt="Изображение ${index + 1}" style="width: 100%; height: 150px; object-fit: cover;">
                <div style="position: absolute; top: 5px; left: 5px; display: flex; gap: 2px;">
                    <button onclick="moveImageUp(${originalIndex})" style="background: rgba(0,150,255,0.8); color: white; border: none; border-radius: 4px; cursor: pointer; padding: 2px 6px; font-size: 10px;" ${upDisabled}>↑</button>
                    <button onclick="moveImageDown(${originalIndex})" style="background: rgba(0,150,255,0.8); color: white; border: none; border-radius: 4px; cursor: pointer; padding: 2px 6px; font-size: 10px;" ${downDisabled}>↓</button>
                </div>
                <button onclick="removeModImage(${originalIndex})" style="position: absolute; top: 5px; right: 5px; background: rgba(255,0,0,0.8); color: white; border: none; border-radius: 4px; cursor: pointer; padding: 4px 8px; font-size: 12px;">✕</button>
            </div>
        `;
    }).join('');
    
    if (html) {
        container.innerHTML = html;
    } else {
        container.innerHTML = '<div style="color: #888; text-align: center; padding: 20px; border: 2px dashed rgba(255,0,0,0.3); border-radius: 8px;">Нет изображений</div>';
    }
};

// Функция для обновления отображения изображений (старая версия для совместимости)
window.updateImagesDisplay = function() {
    const container = document.getElementById('editModImagesContainer');
    if (!container) return;
    
    const html = (window.editModImages ? window.editModImages.filter(img => img !== null) : []).map((img, index) => {
        let imgSrc = '';
        if (typeof img === 'object' && img.url) {
            imgSrc = img.url;
        } else if (typeof img === 'string') {
            imgSrc = img;
        }
        const originalIndex = window.editModImages ? window.editModImages.findIndex(originalImg => originalImg === img) : -1;
        return `
            <div style="position: relative; border: 2px solid rgba(255,0,0,0.3); border-radius: 8px; overflow: hidden;">
                <img src="${imgSrc}" alt="Изображение ${index + 1}" style="width: 100%; height: 150px; object-fit: cover;">
                <button onclick="removeModImage(${originalIndex})" style="position: absolute; top: 5px; right: 5px; background: rgba(255,0,0,0.8); color: white; border: none; border-radius: 4px; cursor: pointer; padding: 4px 8px; font-size: 12px;">✕</button>
            </div>
        `;
    }).join('');
    
    if (html) {
        container.innerHTML = html;
    } else {
        container.innerHTML = '<div style="color: #888; text-align: center; padding: 20px; border: 2px dashed rgba(255,0,0,0.3); border-radius: 8px;">Нет изображений</div>';
    }
};

// Функция для показа уведомлений удалена - используем из ui-modals.js

// Экспорт модуля
window.modsModule = {
    getRussianCategoryName,
    editMod,
    moveImageUp,
    moveImageDown,
    moveMainImageUp,
    moveMainImageDown,
    moveReserveImageUp,
    moveReserveImageDown,
    moveFromReserveToMain,
    moveFromMainToReserve,
    swapMain4WithReserve1,
    swapReserve1WithMain4,
    swapMainWithReserve,
    swapReserveWithMain,
    clearNewImage,
    updateReserveSection,
    removeModImage,
    handleMainImageUpload,
    handleReserveImageUpload,
    clearMainImage,
    clearReserveImage,
    updateMainImageDisplay,
    updateReserveImageDisplay,
    updateAllReserveImagesDisplay,
    updateImageCounter,
    updateReserveSectionDisplay,
    updateModImagesDisplay,
    moveFromReserveToMain,
    showNotification
};

// Тестовая функция для ручного обновления (можно вызвать из консоли)
window.testReserveImages = function() {
    console.log('🧪 [testReserveImages] Тестовое обновление резервных изображений');
    console.log('📊 [testReserveImages] window.newModImages:', window.newModImages);
    console.log('📊 [testReserveImages] window.editModImages:', window.editModImages);
    
    if (window.newModImages && window.newModImages.length > 0) {
        console.log('📊 [testReserveImages] Найдены резервные изображения:', window.newModImages.length);
        console.log('📊 [testReserveImages] Детали резервных изображений:');
        window.newModImages.forEach((img, index) => {
            console.log(`  [${index}] ${img ? img.substring(0, 50) + '...' : 'null'}`);
        });
        updateAllReserveImagesDisplay();
        console.log('✅ [testReserveImages] Обновление завершено');
    } else {
        console.warn('⚠️ [testReserveImages] Резервные изображения не найдены');
    }
    
    if (window.editModImages && window.editModImages.length > 0) {
        console.log('📊 [testReserveImages] Найдены основные изображения:', window.editModImages.length);
    } else {
        console.warn('⚠️ [testReserveImages] Основные изображения не найдены');
    }
};

// Тестовая функция для проверки DOM элементов
window.testReserveDOM = function() {
    console.log('🧪 [testReserveDOM] Проверка DOM элементов резервных изображений');
    
    for (let i = 0; i < 4; i++) {
        const container = document.getElementById(`reserveImagePreview${i}`);
        const label = document.querySelector(`label[for="editModReserveImage${i}"]`);
        const input = document.getElementById(`editModReserveImage${i}`);
        
        console.log(`📊 [testReserveDOM] Резерв ${i}:`, {
            container: !!container,
            label: !!label,
            input: !!input,
            containerHTML: container ? container.innerHTML.substring(0, 100) : 'null',
            containerDisplay: container ? container.style.display : 'null'
        });
        
        if (!container) {
            console.warn(`⚠️ [testReserveDOM] Контейнер для резерва ${i} не найден`);
        }
    }
    
    // Проверяем массивы
    console.log('📊 [testReserveDOM] Проверка массивов:', {
        newModImages: window.newModImages,
        editModImages: window.editModImages
    });
    
    // Принудительно обновляем
    console.log('🔧 [testReserveDOM] Принудительное обновление...');
    updateAllReserveImagesDisplay();
};

// Функция для принудительного показа всех скрытых контейнеров
window.forceShowAllReserveImages = function() {
    console.log('🔧 [forceShowAllReserveImages] Принудительно показываю все скрытые контейнеры');
    
    for (let i = 0; i < 4; i++) {
        const container = document.getElementById(`reserveImagePreview${i}`);
        if (container) {
            console.log(`🔧 [forceShowAllReserveImages] Показываю контейнер ${i}`);
            container.style.display = 'block';
        }
    }
    
    // Обновляем отображение
    updateAllReserveImagesDisplay();
};

// Функция для переключения видимости резервных изображений
window.toggleReserveImagesVisibility = function() {
    console.log('🔄 [toggleReserveImagesVisibility] Переключение видимости резервных изображений');
    
    const container = document.getElementById('reserveImagesContainer');
    const button = document.getElementById('toggleReserveImages');
    
    if (!container || !button) {
        console.warn('⚠️ [toggleReserveImagesVisibility] Контейнер или кнопка не найдены');
        return;
    }
    
    const isVisible = container.style.display !== 'none';
    
    if (isVisible) {
        // Скрываем контейнер
        container.style.display = 'none';
        button.textContent = '👁️ Открыть резервные';
        button.style.background = 'rgba(0,204,255,0.8)';
        console.log('✅ [toggleReserveImagesVisibility] Резервные изображения скрыты');
    } else {
        // Показываем контейнер
        container.style.display = 'flex';
        button.textContent = '👁️ Скрыть резервные';
        button.style.background = 'rgba(255,165,0,0.8)';
        console.log('✅ [toggleReserveImagesVisibility] Резервные изображения показаны');
        
        // Обновляем отображение после показа
        setTimeout(() => {
            if (typeof window.updateAllReserveImagesDisplay === 'function') {
                window.updateAllReserveImagesDisplay();
            }
        }, 100);
    }
};

// Делаем функцию доступной немедленно
window.toggleReserveImagesVisibility = window.toggleReserveImagesVisibility;

// Функция для проверки и принудительного создания всех контейнеров
window.forceShowAllImages = function() {
    console.log('🔧 [forceShowAllImages] Принудительно показываю ВСЕ контейнеры (основные и резервные)');
    
    // Проверяем основные контейнеры
    for (let i = 0; i < 4; i++) {
        const container = document.getElementById(`mainImagePreview${i}`);
        const label = document.querySelector(`label[for="editModMainImage${i}"]`);
        
        if (!container && label && label.parentNode) {
            console.log(`🔧 [forceShowAllImages] Создаю контейнер для основного ${i}`);
            const newContainer = document.createElement('div');
            newContainer.id = `mainImagePreview${i}`;
            newContainer.style.cssText = 'margin-top: 5px; position: relative;';
            label.parentNode.insertBefore(newContainer, label.nextSibling);
        } else if (container) {
            console.log(`🔧 [forceShowAllImages] Показываю контейнер для основного ${i}`);
            container.style.display = 'block';
        }
    }
    
    // Проверяем резервные контейнеры
    for (let i = 0; i < 4; i++) {
        const container = document.getElementById(`reserveImagePreview${i}`);
        const label = document.querySelector(`label[for="editModReserveImage${i}"]`);
        
        if (!container && label && label.parentNode) {
            console.log(`🔧 [forceShowAllImages] Создаю контейнер для резерва ${i}`);
            const newContainer = document.createElement('div');
            newContainer.id = `reserveImagePreview${i}`;
            newContainer.style.cssText = 'margin-top: 5px; position: relative;';
            label.parentNode.insertBefore(newContainer, label.nextSibling);
        } else if (container) {
            console.log(`🔧 [forceShowAllImages] Показываю контейнер для резерва ${i}`);
            container.style.display = 'block';
        }
    }
    
    // Обновляем отображение
    updateMainImagesDisplay();
    updateAllReserveImagesDisplay();
};

// Глобальные функции для обратной совместимости
window.getRussianCategoryName = getRussianCategoryName;
window.editMod = editMod;
window.moveImageUp = moveImageUp;
window.moveImageDown = moveImageDown;
window.moveMainImageUp = moveMainImageUp;
window.moveMainImageDown = moveMainImageDown;
window.moveReserveImageUp = moveReserveImageUp;
window.moveReserveImageDown = moveReserveImageDown;
window.moveFromReserveToMain = moveFromReserveToMain;
window.moveFromMainToReserve = moveFromMainToReserve;
window.swapMain4WithReserve1 = swapMain4WithReserve1;
window.swapReserve1WithMain4 = swapReserve1WithMain4;
window.swapMainWithReserve = swapMainWithReserve;
window.swapReserveWithMain = swapReserveWithMain;
window.clearNewImage = clearNewImage;
window.updateReserveSection = updateReserveSection;
window.removeModImage = removeModImage;
window.handleMainImageUpload = handleMainImageUpload;
window.handleReserveImageUpload = handleReserveImageUpload;
window.clearMainImage = clearMainImage;
window.clearReserveImage = clearReserveImage;
window.updateMainImageDisplay = updateMainImageDisplay;
window.updateSingleMainImageDisplay = updateSingleMainImageDisplay;
window.updateReserveImageDisplay = updateReserveImageDisplay;
window.updateAllReserveImagesDisplay = updateAllReserveImagesDisplay;
window.updateImageCounter = updateImageCounter;
window.updateReserveSectionDisplay = updateReserveSectionDisplay;
window.updateModImagesDisplay = updateModImagesDisplay;
window.moveFromReserveToMain = moveFromReserveToMain;
// showNotification экспортируется из ui-modals.js

// Гарантируем доступность функции toggleReserveImagesVisibility
if (typeof window.toggleReserveImagesVisibility !== 'function') {
    window.toggleReserveImagesVisibility = function() {
        console.log('🔄 [toggleReserveImagesVisibility] Переключение видимости резервных изображений');
        
        const container = document.getElementById('reserveImagesContainer');
        const button = document.getElementById('toggleReserveImages');
        
        if (!container || !button) {
            console.warn('⚠️ [toggleReserveImagesVisibility] Контейнер или кнопка не найдены');
            return;
        }
        
        const isVisible = container.style.display !== 'none';
        
        if (isVisible) {
            container.style.display = 'none';
            button.textContent = '👁️ Открыть резервные';
            button.style.background = 'rgba(0,204,255,0.8)';
            console.log('✅ [toggleReserveImagesVisibility] Резервные изображения скрыты');
        } else {
            container.style.display = 'flex';
            button.textContent = '👁️ Скрыть резервные';
            button.style.background = 'rgba(255,165,0,0.8)';
            console.log('✅ [toggleReserveImagesVisibility] Резервные изображения показаны');
            
            setTimeout(() => {
                if (typeof window.updateAllReserveImagesDisplay === 'function') {
                    window.updateAllReserveImagesDisplay();
                }
            }, 100);
        }
    };
}

// Глобальная заглушка для toggleReserveImagesVisibility - всегда доступна
if (typeof window.toggleReserveImagesVisibility !== 'function') {
    window.toggleReserveImagesVisibility = function() {
        console.warn('⚠️ [toggleReserveImagesVisibility] Используется глобальная заглушка');
        
        const container = document.getElementById('reserveImagesContainer');
        const button = document.getElementById('toggleReserveImages');
        
        if (!container || !button) {
            console.warn('⚠️ [toggleReserveImagesVisibility] Контейнер или кнопка не найдены');
            alert('Резервные изображения: элементы интерфейса не найдены. Пожалуйста, обновите страницу.');
            return;
        }
        
        const isVisible = container.style.display !== 'none';
        
        if (isVisible) {
            container.style.display = 'none';
            button.textContent = '👁️ Открыть резервные';
            button.style.background = 'rgba(0,204,255,0.8)';
            console.log('✅ [toggleReserveImagesVisibility] Резервные изображения скрыты (заглушка)');
        } else {
            container.style.display = 'flex';
            button.textContent = '👁️ Скрыть резервные';
            button.style.background = 'rgba(255,165,0,0.8)';
            console.log('✅ [toggleReserveImagesVisibility] Резервные изображения показаны (заглушка)');
        }
    };
    console.log('✅ [mods.js] Создана глобальная заглушка для toggleReserveImagesVisibility');
}
