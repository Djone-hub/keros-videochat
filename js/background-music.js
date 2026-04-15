// Модуль фоновой музыки KEROS MODS 2025
// Обеспечивает глобально доступные функции для управления фоновой музыкой

// Глобальные переменные
window.backgroundMusicAudio = null;
window.backgroundMusicSettings = {
    url: '',
    volume: 0.05,
    autoplay: false,
    loop: true,
    fileName: '', // For local files
    wasManuallyStopped: false // Флаг для отслеживания ручной остановки
};

// Helper to save settings to Supabase
window._saveBackgroundMusicSettingsToSupabase = async function(settings) {
    console.log('💾 Сохранение настроек фоновой музыки в Supabase:', settings);

    try {
        if (typeof supabase === 'undefined') {
            console.warn('⚠️ Supabase не доступен');
            return false;
        }

        const settingsString = JSON.stringify(settings);

        const { error } = await supabase
            .from('site_settings')
            .upsert({
                setting_key: 'background_music',
                setting_value: settingsString,
                setting_type: 'json',
                description: 'Настройки фоновой музыки сайта'
            }, {
                onConflict: 'setting_key'
            });

        if (error) {
            throw error;
        }

        console.log('✅ Настройки фоновой музыки сохранены в Supabase');
        return true;

    } catch (error) {
        console.error('❌ Ошибка сохранения настроек фоновой музыки в Supabase:', error);
        return false;
    }
};

// Helper to load settings from Supabase
window._loadBackgroundMusicSettingsFromSupabase = async function() {
    console.log('📂 Загрузка настроек фоновой музыки из Supabase');

    try {
        if (typeof supabase === 'undefined') {
            console.warn('⚠️ Supabase не доступен');
            return null;
        }

        const { data, error } = await supabase
            .from('site_settings')
            .select('setting_value')
            .eq('setting_key', 'background_music')
            .maybeSingle(); // ИСПРАВЛЕНИЕ: Используем maybeSingle() для обработки случая, когда запись не найдена

        if (error) {
            if (error.code === 'PGRST116') {
                console.log('ℹ️ Настройки фоновой музыки не найдены в Supabase');
                return null;
            }
            throw error;
        }

        if (!data || !data.setting_value) {
            console.log('ℹ️ Настройки фоновой музыки пусты в Supabase');
            return null;
        }

        const settings = JSON.parse(data.setting_value);
        console.log('✅ Настройки фоновой музыки загружены из Supabase:', settings);

        return settings;

    } catch (error) {
        console.error('❌ Ошибка загрузки настроек фоновой музыки из Supabase:', error);
        return null;
    }
};

// Global function - set site music volume
window.setSiteMusicVolume = function(volumePercentage) { // Expects 0-100
    const volume = volumePercentage / 100; // Convert percentage to 0-1 range
    console.log(`🔊 Установка громкости фоновой музыки: ${volume}`);

    if (typeof volume !== 'number' || volume < 0 || volume > 1) {
        console.error('❌ Неверная громкость:', volume);
        return false;
    }

    window.backgroundMusicSettings.volume = volume;

    if (window.backgroundMusicAudio) {
        window.backgroundMusicAudio.volume = volume;
    }

    // ✅ ИСПРАВЛЕНИЕ: Немедленно обновляем текстовое значение громкости в UI
    const volumeValueElement = document.getElementById('bgMusicVolumeValue');
    if (volumeValueElement) {
        volumeValueElement.textContent = volumePercentage + '%';
    }

    // No need to save to localStorage here, only when explicitly saving settings.
    console.log('✅ Громкость обновлена:', volume);
    return true;
};

// Global function - get current volume
window.getSiteMusicVolume = function() {
    const volume = window.backgroundMusicSettings.volume;
    console.log(`🔊 Текущая громкость: ${volume}`);
    return volume;
};

// Global function - start background music
window.startBackgroundMusic = async function(url, volume = window.backgroundMusicSettings.volume) {
    console.log('🎵 Запуск фоновой музыки:', url, 'с громкостью:', volume);

    try {
        // Stop previous music if playing
        if (window.backgroundMusicAudio) {
            window.stopBackgroundMusic();
        }

        // Create new audio element
        window.backgroundMusicAudio = new Audio();
        window.backgroundMusicAudio.src = url;
        window.backgroundMusicAudio.volume = volume;
        window.backgroundMusicAudio.loop = window.backgroundMusicSettings.loop;

        // Update settings (only URL and volume, other settings are managed elsewhere)
        window.backgroundMusicSettings.url = url;
        window.backgroundMusicSettings.volume = volume;

        // Start playback
        await window.backgroundMusicAudio.play();

        console.log('✅ Фоновая музыка запущена успешно');

        // Обновляем индикатор сразу после успешного запуска
        window.updateBackgroundMusicIndicator && window.updateBackgroundMusicIndicator();

        return true;

    } catch (error) {
        // Only show notification if it's not a NotAllowedError (which is handled by the indicator)
        if (error.name !== 'NotAllowedError') {
            console.error('❌ Ошибка воспроизведения музыки:', error);
            showNotification('❌ Ошибка воспроизведения музыки: ' + error.message, 'error');
        } else {
            // NotAllowedError - это нормальное поведение браузера, не ошибка
            console.warn('🚫 Автозапуск музыки заблокирован браузером (ожидаемо)');
        }
        // ✅ ИСПРАВЛЕНИЕ: Пробрасываем ошибку дальше, чтобы ее мог поймать вызывающий код (например, в initializeBackgroundMusic)
        throw error;
    }
};

// Global function - stop background music
window.stopBackgroundMusic = function() {
    console.log('⏹️ Остановка фоновой музыки');

    if (window.backgroundMusicAudio) {
        window.backgroundMusicAudio.pause();
        window.backgroundMusicAudio.currentTime = 0; // Сбрасываем на начало
        // НЕ устанавливаем в null, чтобы сохранить источник
    }

    window.backgroundMusicSettings.wasManuallyStopped = true; // Устанавливаем флаг, что музыка остановлена пользователем

    // Update indicator if exists
    if (typeof window.updateBackgroundMusicIndicator === 'function') {
        window.updateBackgroundMusicIndicator();
    }

    console.log('✅ Фоновая музыка остановлена');
};

// Global function - update indicator
window.updateBackgroundMusicIndicator = function() {
    const indicator = document.getElementById('background-music-indicator');
    const musicIcon = document.getElementById('music-status-icon');
    const musicText = document.getElementById('music-status-text');
    
    if (!indicator || !musicIcon || !musicText) return;
    
    const isPlaying = window.backgroundMusicAudio && !window.backgroundMusicAudio.paused;

    if (isPlaying) {
        musicIcon.textContent = '🎵';
        musicText.textContent = 'Играет';
    } else {
        musicIcon.textContent = '🔇';
        musicText.textContent = 'Музыка';
    }
};

// Global function - toggle background music (simplified)
window.toggleBackgroundMusic = function() {
    console.log('🎵 Переключение фоновой музыки');

    // Если идет автозапуск, не делаем ничего
    if (window.backgroundMusicSettings.isAutostarting) {
        console.log('🎵 Автозапуск в процессе, пропускаем переключение');
        return;
    }

    const isPlaying = window.backgroundMusicAudio && !window.backgroundMusicAudio.paused;

    window.backgroundMusicSettings.wasManuallyStopped = !isPlaying;

    if (isPlaying) {
        window.stopBackgroundMusic();
        // Устанавливаем флаг ручной остановки
        window.backgroundMusicSettings.wasManuallyStopped = true;
        localStorage.setItem('km_music_manually_stopped', 'true');
        showNotification('⏹️ Фоновая музыка остановлена', 'info');
    } else {
        // Сбрасываем флаг ручной остановки при попытке запуска
        window.backgroundMusicSettings.wasManuallyStopped = false;
        localStorage.setItem('km_music_manually_stopped', 'false');

        // Если плеер уже существует и у него есть источник, просто запускаем его
        if (window.backgroundMusicAudio && window.backgroundMusicAudio.src) {
            window.backgroundMusicAudio.play().catch(e => console.error("Ошибка воспроизведения при переключении:", e));
            showNotification('🎵 Фоновая музыка запущена', 'success');
        } else {
            // Иначе, пытаемся запустить с сохраненным URL
            // ИСПРАВЛЕНИЕ: Получаем URL из input'а в админке, если он есть, иначе из настроек
            const urlInput = document.getElementById('bgMusicUrlInput');
            let url = (urlInput && urlInput.value) ? urlInput.value.trim() : window.backgroundMusicSettings.url;

            // Проверяем, что URL валиден
            if (!url || url.startsWith('blob:')) { // blob: URL'ы не сохраняются между сессиями
                showNotification('🎵 Источник музыки не найден. Выберите трек в админ-панели.', 'warning');
                return;
            }
            window.startBackgroundMusic(url, window.backgroundMusicSettings.volume).catch(e => console.error("Ошибка запуска музыки при переключении:", e));
        }
        // Обновляем индикатор в любом случае после попытки запуска
        window.updateBackgroundMusicIndicator && window.updateBackgroundMusicIndicator();
    }

    // Гарантируем, что индикатор будет создан, если его нет
    if (!document.getElementById('backgroundMusicIndicator')) {
        window.initializeBackgroundMusicIndicator && window.initializeBackgroundMusicIndicator();
    }
};

// Global function - initialize background music on site load
window.initializeBackgroundMusic = async function() {
    console.log('🎵 Инициализация фоновой музыки...');
    
    try {
        // Load settings from Supabase
        const settings = await window._loadBackgroundMusicSettingsFromSupabase();
        
        if (settings) {
            // Update global settings with loaded values
            window.backgroundMusicSettings = { ...window.backgroundMusicSettings, ...settings };
        }
        
        // ✅ ИСПРАВЛЕНИЕ: Упрощаем проверку. Теперь любой валидный URL будет работать.
        const isValidUrl = settings && settings.url;
        // ИСПРАВЛЕНИЕ: Используем глобальный флаг, который синхронизируется с localStorage
        window.backgroundMusicSettings.wasManuallyStopped = localStorage.getItem('km_music_manually_stopped') === 'true';
        
        // Если автозапуск включен в новых настройках, игнорируем предыдущую ручную остановку
        if (settings && settings.autoplay) {
            window.backgroundMusicSettings.wasManuallyStopped = false;
            localStorage.setItem('km_music_manually_stopped', 'false'); // И сбрасываем в хранилище
        }

        if (isValidUrl && settings.autoplay && !window.backgroundMusicSettings.wasManuallyStopped) {
            console.log('🎯 Автозапуск фоновой музыки по настройкам');
            try {
                window.backgroundMusicSettings.wasManuallyStopped = false; // Сбрасываем флаг
                await window.startBackgroundMusic(settings.url, settings.volume); // This is fine
            } catch (playError) {
                if (playError.name === 'NotAllowedError') {
                    console.warn('🚫 Автозапуск фоновой музыки заблокирован браузером.');
                    // Показываем уведомление с предложением включить музыку вручную
                    if (typeof showNotification === 'function') {
                        showNotification('🎵 Для включения фоновой музыки нажмите на кнопку в углу', 'info', 6000);
                    }
                    
                    // Добавляем обработчик первого клика для разблокировки музыки
                    const enableMusicOnFirstClick = function() {
                        console.log('🎵 Первый клик пользователя, пытаемся запустить музыку');
                        // Устанавливаем флаг что это автозапуск, чтобы не сбросить его в toggleBackgroundMusic
                        window.backgroundMusicSettings.isAutostarting = true;
                        window.startBackgroundMusic(settings.url, settings.volume)
                            .then(() => {
                                // Сбрасываем флаг после успешного запуска
                                window.backgroundMusicSettings.isAutostarting = false;
                                console.log('✅ Автозапуск музыки успешно завершен');
                            })
                            .catch((error) => {
                                // Сбрасываем флаг при ошибке
                                window.backgroundMusicSettings.isAutostarting = false;
                                if (error.name === 'NotAllowedError') {
                                    console.warn('🚫 Автозапуск фоновой музыки заблокирован браузером.');
                                } else {
                                    console.error('❌ Ошибка автозапуска музыки:', error);
                                }
                            });
                        // Удаляем обработчик после первого использования
                        document.removeEventListener('click', enableMusicOnFirstClick);
                        document.removeEventListener('keydown', enableMusicOnFirstClick);
                    };
                    
                    // Добавляем обработчики на клик и нажатие клавиши
                    document.addEventListener('click', enableMusicOnFirstClick, { once: true });
                    document.addEventListener('keydown', enableMusicOnFirstClick, { once: true });
                } else {
                    // Другие ошибки воспроизведения
                    console.error('❌ Ошибка автозапуска фоновой музыки:', playError);
                    showNotification('❌ Ошибка воспроизведения фоновой музыки.', 'error');
                }
            }
        } else {
            console.log(`🚫 Автозапуск пропущен. Причина: ${!isValidUrl ? 'невалидный URL' : !settings.autoplay ? 'отключен в настройках' : 'остановлено пользователем'}`);
        }

        // Инициализируем индикатор музыки после основной логики
        if (typeof window.initializeBackgroundMusicIndicator === 'function') {
            window.initializeBackgroundMusicIndicator();
        }

        // Гарантируем, что индикатор будет создан, если его нет
        if (!document.getElementById('backgroundMusicIndicator')) {
            window.initializeBackgroundMusicIndicator && window.initializeBackgroundMusicIndicator();
        }

        console.log('✅ Фоновая музыка инициализирована');
        return true;

    } catch (error) {
        console.error('❌ Ошибка инициализации фоновой музыки:', error);
        return false;
    }
};

// Global function - create simple indicator
window.initializeBackgroundMusicIndicator = function() {
    console.log('🎨 Создание индикатора фоновой музыки');

    // ✅ ИСПРАВЛЕНИЕ: Проверяем, существует ли индикатор, чтобы не создавать его повторно.
    if (document.getElementById('backgroundMusicIndicator')) {
        console.log('🎨 Индикатор уже существует. Обновляем состояние.');
        window.updateBackgroundMusicIndicator();
        return;
    }
    // Удаляем существующий индикатор если есть
    const existingIndicator = document.getElementById('backgroundMusicIndicator');
    if (existingIndicator) {
        existingIndicator.remove();
    }
    
    // Создаем новый индикатор
    const indicator = document.createElement('div');
    indicator.id = 'backgroundMusicIndicator';
    indicator.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 20px;
        background: linear-gradient(135deg, rgba(0, 0, 0, 0.7), rgba(40, 40, 40, 0.8));
        color: white;
        padding: 8px 12px;
        border-radius: 20px;
        font-size: 12px;
        cursor: pointer;
        z-index: 1000;
        transition: all 0.4s ease-in-out;
        border: 1px solid rgba(76, 175, 80, 0.3);
        backdrop-filter: blur(5px);
        display: flex;
        align-items: center;
    `;

    indicator.innerHTML = `
        <span id="musicIcon" style="font-size: 14px; transition: all 0.3s ease;">🎵</span>
        <span id="musicText" style="opacity: 0.7;">Музыка</span>
    `;

    // Добавляем обработчик клика для переключения
    indicator.addEventListener('click', () => {
        window.toggleBackgroundMusic();
    });
    
    // Добавляем в документ
    document.body.appendChild(indicator);

    // Стили для анимации при воспроизведении
    const style = document.createElement('style');
    style.textContent = `
        @keyframes musicPulse {
            0% { transform: scale(1); box-shadow: 0 0 5px rgba(76, 175, 80, 0.4); }
            50% { transform: scale(1.05); box-shadow: 0 0 15px rgba(76, 175, 80, 0.8); }
            100% { transform: scale(1); box-shadow: 0 0 5px rgba(76, 175, 80, 0.4); }
        }
        .music-playing {
            animation: musicPulse 1.5s infinite ease-in-out;
            border-color: #4CAF50 !important;
            box-shadow: 0 0 10px rgba(76, 175, 80, 0.5);
        }
    `;
    document.head.appendChild(style);

    // Обновляем индикатор
    window.updateBackgroundMusicIndicator();

    console.log('✅ Индикатор фоновой музыки создан');
};

// Global function - update indicator
window.updateBackgroundMusicIndicator = function() {
    const indicator = document.getElementById('backgroundMusicIndicator');
    const musicIcon = document.getElementById('musicIcon');
    const musicText = document.getElementById('musicText');
    
    if (!indicator || !musicIcon || !musicText) return;
    
    const isPlaying = window.backgroundMusicAudio && !window.backgroundMusicAudio.paused;

    if (isPlaying) {
        // Музыка играет
        indicator.classList.add('music-playing');
        musicIcon.textContent = '🎵';
        musicText.textContent = 'Играет';
        musicText.style.opacity = '1';
        indicator.title = 'Фоновая музыка играет. Нажмите для остановки.';
    } else {
        // Музыка остановлена
        indicator.classList.remove('music-playing');
        musicIcon.textContent = '🔇';
        musicText.textContent = 'Музыка';
        musicText.style.opacity = '0.7';
        indicator.title = 'Фоновая музыка остановлена. Нажмите для запуска.';
    }
};

// Глобальная функция - загрузка настроек из базы данных
window.loadBackgroundMusicSettings = async function() {
    console.log('📂 Загрузка настроек фоновой музыки из базы данных');
    
    try {
        if (!window.supabase) {
            console.warn('⚠️ Supabase не доступен');
            return null;
        }
        
        const { data, error } = await window.supabase
            .from('site_settings')
            .select('setting_value')
            .eq('setting_key', 'background_music')
            .single();
        
        if (error) {
            if (error.code === 'PGRST116') {
                // Запись не найдена - это нормально
                console.log('ℹ️ Настройки фоновой музыки не найдены в базе данных');
                return null;
            }
            throw error;
        }
        
        if (!data || !data.setting_value) {
            console.log('ℹ️ Настройки фоновой музыки пусты');
            return null;
        }
        
        const settings = JSON.parse(data.setting_value);
        console.log('✅ Настройки фоновой музыки загружены:', settings);
        
        // Обновляем глобальные настройки
        window.backgroundMusicSettings = { ...window.backgroundMusicSettings, ...settings };
        
        return settings;
        
    } catch (error) {
        console.error('❌ Ошибка загрузки настроек фоновой музыки:', error);
        return null;
    }
};

// Глобальная функция - сохранение настроек в базу данных
window.saveBackgroundMusicSettings = async function(settings) {
    console.log('💾 Сохранение настроек фоновой музыки:', settings);
    
    try {
        if (!window.supabase) {
            console.warn('⚠️ Supabase не доступен');
            return false;
        }
        
        const settingsString = JSON.stringify(settings);
        
        const { error } = await window.supabase
            .from('site_settings')
            .upsert({
                setting_key: 'background_music',
                setting_value: settingsString,
                setting_type: 'json',
                description: 'Настройки фоновой музыки сайта'
            }, {
                onConflict: 'setting_key'
            });
        
        if (error) {
            throw error;
        }
        
        console.log('✅ Настройки фоновой музыки сохранены');
        return true;
        
    } catch (error) {
        console.error('❌ Ошибка сохранения настроек фоновой музыки:', error);
        return false;
    }
};

// Глобальная функция - тестирование воспроизведения
window.testBackgroundMusicWithIndicator = async function(url, volume = 0.05) {
    console.log('🧪 Тестирование фоновой музыки:', url);
    
    try {
        await window.startBackgroundMusic(url, volume);
        showNotification('🎵 Тест фоновой музыки запущен', 'success');
        return true;
    } catch (error) {
        console.error('❌ Ошибка теста:', error);
        showNotification('❌ Ошибка теста музыки', 'error');
        return false;
    }
};

/**
 * ✅ ИСПРАВЛЕНИЕ: Функция переписана как function declaration, чтобы избежать ошибок ReferenceError.
 * Открывает диалог для загрузки музыкального файла в хранилище Supabase.
 */
function selectMusicFile() {
    console.log('📂 Открытие диалога для загрузки музыкального файла в хранилище Supabase...');

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'audio/*';
    fileInput.style.display = 'none';

    fileInput.onchange = async function() {
        console.log('📁 Файл выбран, анализируем...');
        const file = this.files[0];
        console.log('📁 Информация о файле:', {
            name: file?.name,
            type: file?.type,
            size: file?.size,
            exists: !!file
        });
        
        if (!file) {
            console.log('❌ Файл не выбран');
            return;
        }

        if (!file.type.startsWith('audio/')) {
            console.log('❌ Неверный тип файла:', file.type);
            showNotification('❌ Выберите музыкальный файл (mp3, wav, ogg)', 'error');
            return;
        }

        console.log('✅ Файл прошел проверку, начинаем загрузку в Supabase...');
        showNotification('🔄 Загрузка трека в хранилище Supabase...', 'info');

        try {
            // Проверяем доступ к Supabase
            if (!window.supabase) {
                console.error('❌ Supabase не доступен для загрузки файла');
                showNotification('❌ Supabase не доступен', 'error');
                document.body.removeChild(fileInput);
                return;
            }
            
            const bucket = 'media';
            // Сохраняем оригинальное расширение для audio bucket
            const filePath = `background-music/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;

            // Используем оригинальный файл для audio bucket
            const arrayBuffer = await file.arrayBuffer();
            const audioBlob = new Blob([arrayBuffer], { type: file.type });
            
            // Получаем токен аутентификации
            const { data: { session } } = await window.supabase.auth.getSession();
            const token = session?.access_token;
            
            if (!token) {
                throw new Error('Токен аутентификации не найден');
            }
            
            // Используем прямой fetch запрос с правильным аудио bucket
            console.log('📤 Загружаем файл в audio bucket...');
            
            const formData = new FormData();
            formData.append('file', audioBlob, file.name);
            
            const response = await fetch(`https://gtixajbcfxwqrtsdxnif.supabase.co/storage/v1/object/${bucket}/${filePath}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || `HTTP ${response.status}: ${response.statusText}`);
            }
            
            const uploadData = await response.json();
            console.log('✅ Файл успешно загружен в audio bucket:', uploadData);

            // Получаем публичную ссылку на загруженный файл
            const { data: publicUrlData } = window.supabase.storage.from(bucket).getPublicUrl(filePath);
            const publicUrl = publicUrlData.publicUrl;

            if (!publicUrl) {
                showNotification('❌ Критическая ошибка: не удалось получить URL для загруженного файла.', 'error');
                throw new Error('Не удалось получить публичную ссылку на файл.');
            }

            console.log('✅ Файл успешно загружен. Публичная ссылка:', publicUrl);
            showNotification('✅ Трек загружен! Устанавливаем как фоновую музыку...', 'success');

            // Устанавливаем новый трек и обновляем UI
            const urlInput = document.getElementById('bgMusicUrlInput');
            if (urlInput) {
                urlInput.value = publicUrl;
                window.backgroundMusicSettings.url = publicUrl;
                window.backgroundMusicSettings.fileName = file.name;
            }
            
            // Сохраняем настройки в базу данных
            await window.saveBackgroundMusicSettings(window.backgroundMusicSettings);
            
            // Запускаем воспроизведение
            await window.startBackgroundMusic(publicUrl, window.backgroundMusicSettings.volume);

        } catch (error) {
            console.error('❌ Ошибка загрузки фоновой музыки:', error);
            showNotification(`❌ Ошибка загрузки: ${error.message}`, 'error');
        } finally {
            document.body.removeChild(fileInput);
        }
    };

    document.body.appendChild(fileInput);
    fileInput.click();
}

/**
 * Загружает локальный файл музыки.
 * @param {HTMLInputElement} inputElement - Элемент input[type=file].
 */
function loadLocalMusicFile(inputElement) {
    console.log('📁 Загрузка локального музыкального файла');
    
    const file = inputElement.files && inputElement.files[0];
    if (!file) {
        showNotification('❌ Файл не выбран', 'warning');
        return;
    }
    
    if (!file.type.startsWith('audio/')) {
        showNotification('❌ Выберите музыкальный файл (mp3, wav, ogg)', 'warning');
        return;
    }
    
    const url = URL.createObjectURL(file);
    
    window.backgroundMusicSettings.url = url;
    window.backgroundMusicSettings.fileName = file.name;
    window.backgroundMusicSettings.fileSize = file.size;
    
    localStorage.setItem('backgroundMusicUrl', url);
    localStorage.setItem('backgroundMusicFileName', file.name);
    
    console.log('✅ Локальный файл загружен:', file.name);
    
    const sizeMB = (file.size / 1024 / 1024).toFixed(2);
    showNotification(`🎵 Файл "${file.name}" загружен (${sizeMB} MB)`, 'success');
    
    return url;
}

async function loadBackgroundMusicSettingsToAdminPanel() {
    console.log('🎛️ Загрузка настроек фоновой музыки в админ-панель');
    
    try {
        // Загружаем настройки из базы данных
        const settings = await window._loadBackgroundMusicSettingsFromSupabase();
        
        if (settings) {
            // Обновляем глобальные настройки
            window.backgroundMusicSettings = { ...window.backgroundMusicSettings, ...settings };
            
            // Обновляем элементы формы если они существуют
            const urlInput = document.getElementById('bgMusicUrlInput');
            if (urlInput && settings.url) {
                urlInput.value = settings.url;
            }
            
            const volumeSlider = document.getElementById('bgMusicVolumeSlider');
            if (volumeSlider && settings.volume !== undefined) {
                const volumePercent = Math.round(settings.volume * 100);
                volumeSlider.value = volumePercent;
                const volumeValue = document.getElementById('bgMusicVolumeValue');
                if (volumeValue) {
                    volumeValue.textContent = volumePercent + '%';
                }
            }
            
            const autoplayCheckbox = document.getElementById('bgMusicAutoplay');
            if (autoplayCheckbox && settings.autoplay !== undefined) {
                autoplayCheckbox.checked = settings.autoplay;
            }
            
            console.log('✅ Настройки загружены в админ-панель:', settings);
        } else {
            console.log('ℹ️ Настройки не найдены, используем значения по умолчанию');
            
            // Устанавливаем значения по умолчанию
            const volumeSlider = document.getElementById('bgMusicVolumeSlider');
            if (volumeSlider) {
                const defaultVolume = Math.round(window.backgroundMusicSettings.volume * 100);
                volumeSlider.value = defaultVolume;
                const volumeValue = document.getElementById('bgMusicVolumeValue');
                if (volumeValue) {
                    volumeValue.textContent = defaultVolume + '%';
                }
            }
        }
        
    } catch (error) {
        console.error('❌ Ошибка загрузки настроек в админ-панель:', error);
    }
};

async function saveBackgroundMusicSettingsFromAdmin() {
    console.log('💾 Сохранение настроек фоновой музыки из админ-панели');

    try {
        // Получаем текущие значения из формы
        const urlInput = document.getElementById('bgMusicUrlInput');
        const volumeSlider = document.getElementById('bgMusicVolumeSlider');
        const autoplayCheckbox = document.getElementById('bgMusicAutoplay');
        
        // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Всегда считываем актуальные значения из формы перед сохранением.
        const settings = {
            url: urlInput ? urlInput.value.trim() : window.backgroundMusicSettings.url,
            volume: volumeSlider ? parseFloat(volumeSlider.value) / 100 : window.backgroundMusicSettings.volume,
            autoplay: autoplayCheckbox ? autoplayCheckbox.checked : window.backgroundMusicSettings.autoplay,
            loop: window.backgroundMusicSettings.loop,
            fileName: window.backgroundMusicSettings.fileName || ''
        };

        // Если автозапуск включен, сбрасываем флаг ручной остановки
        if (settings.autoplay) {
            localStorage.setItem('km_music_manually_stopped', 'false');
            console.log('🔄 Сброшен флаг ручной остановки из-за включения автозапуска.');
        }
        
        // Сохраняем в базу данных
        const saved = await window._saveBackgroundMusicSettingsToSupabase(settings);
        
        if (saved) {
            // Обновляем глобальные настройки
            window.backgroundMusicSettings = { ...window.backgroundMusicSettings, ...settings };
            
            // Показываем уведомление об успехе
            if (typeof showNotification === 'function') {
                showNotification('✅ Настройки фоновой музыки сохранены!', 'success');
            }
            
            console.log('✅ Настройки сохранены из админ-панели:', settings);
        } else {
            throw new Error('Не удалось сохранить настройки в базу данных');
        }
        
    } catch (error) {
        console.error('❌ Ошибка сохранения настроек из админ-панели:', error);
        if (typeof showNotification === 'function') {
            showNotification('❌ Ошибка сохранения настроек: ' + error.message, 'error');
        }
    }
};

function setBackgroundMusicUrl() {
    console.log('🔗 Установка URL фоновой музыки');
    
    const urlInput = document.getElementById('bgMusicUrlInput');
    if (!urlInput) {
        console.error('❌ Элемент bgMusicUrlInput не найден');
        return;
    }
    
    const url = urlInput.value.trim();
    if (!url) {
        if (typeof showNotification === 'function') {
            showNotification('❌ Введите URL аудиофайла', 'warning');
        }
        return;
    }
    
    // Валидация URL
    try {
        new URL(url);
    } catch (e) {
        if (typeof showNotification === 'function') {
            showNotification('❌ Неверный формат URL', 'error');
        }
        return;
    }
    
    // Обновляем настройки
    window.backgroundMusicSettings.url = url;
    
    // Тестируем воспроизведение
    window.testBackgroundMusicWithIndicator(url, window.backgroundMusicSettings.volume);
    
    if (typeof showNotification === 'function') {
        showNotification('🎵 URL музыки установлен', 'success');
    }
    
    console.log('✅ URL фоновой музыки установлен:', url);
};

function toggleBackgroundMusicAutoplay() {
    console.log('🔄 Переключение автозапуска фоновой музыки');
    
    const autoplayCheckbox = document.getElementById('bgMusicAutoplay');
    if (!autoplayCheckbox) {
        console.error('❌ Элемент bgMusicAutoplay не найден');
        return;
    }
    
    const isEnabled = autoplayCheckbox.checked;
    window.backgroundMusicSettings.autoplay = isEnabled;

    // ИСПРАВЛЕНИЕ: Уведомляем пользователя и логируем актуальное состояние.
    // Это изменение не влияет на логику, но помогает в диагностике.
    console.log('✅ Автозапуск фоновой музыки:', isEnabled ? 'включен' : 'выключен');
    
    console.log('✅ Автозапуск фоновой музыки:', isEnabled ? 'включен' : 'выключен');
    
    if (typeof showNotification === 'function') {
        showNotification(`🎵 Автозапуск ${isEnabled ? 'включен' : 'выключен'}`, 'info');
    }
};

// =========================================================================
// ✅ ИСПРАВЛЕНИЕ: Все глобальные присвоения вынесены в конец файла.
// Это гарантирует, что все функции уже определены к моменту их экспорта.
// =========================================================================
window.selectMusicFile = selectMusicFile;
window.loadLocalMusicFile = loadLocalMusicFile;
window.loadBackgroundMusicSettingsToAdminPanel = loadBackgroundMusicSettingsToAdminPanel;
window.saveBackgroundMusicSettingsFromAdmin = saveBackgroundMusicSettingsFromAdmin;
window.setBackgroundMusicUrl = setBackgroundMusicUrl;
window.toggleBackgroundMusicAutoplay = toggleBackgroundMusicAutoplay;