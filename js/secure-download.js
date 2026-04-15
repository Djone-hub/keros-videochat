// Защищенная система скачивания VIP модов
class SecureDownloadManager {
    constructor() {
        this.supabaseUrl = 'https://gtixajbcfxwqrtsdxnif.supabase.co';
        this.supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhhamJjZnh3cXJ0c2R4bmlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1ODczNDQsImV4cCI6MjA4NzE2MzM0NH0.3EJE8L2yFjB6_WfQxjAqkL0aK5c8tJg4hB9T1q0yX0';
    }

    // Получение защищенной ссылки на скачивание
    async getSecureDownloadUrl(modId, userId) {
        try {
            console.log('🔐 [SECURE DOWNLOAD] Запрос защищенной ссылки для мода:', modId);
            
            // Получаем текущий токен пользователя
            const { data: { session } } = await window.supabase.auth.getSession();
            
            if (!session?.access_token) {
                throw new Error('Пользователь не авторизован');
            }
            
            const response = await fetch(`${this.supabaseUrl}/functions/v1/get-vip-download-link`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    modId: modId
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('❌ [SECURE DOWNLOAD] Ошибка получения ссылки:', errorData);
                
                // Показываем понятное сообщение об ошибке
                if (response.status === 403) {
                    throw new Error('Доступ запрещен. Требуется VIP статус.');
                } else if (response.status === 401) {
                    throw new Error('Необходима авторизация.');
                } else {
                    throw new Error(errorData.error || 'Ошибка получения ссылки для скачивания.');
                }
            }

            const data = await response.json();
            console.log('✅ [SECURE DOWNLOAD] Защищенная ссылка получена:', {
                modName: data.modName,
                isVipMod: data.isVipMod,
                expiresInSeconds: data.expiresInSeconds
            });

            return data;

        } catch (error) {
            console.error('❌ [SECURE DOWNLOAD] Критическая ошибка:', error);
            throw error;
        }
    }

    // Скачивание мода через защищенную ссылку
    async downloadModSecure(modId) {
        try {
            console.log('🔐 [SECURE DOWNLOAD] Начало защищенного скачивания мода:', modId);

            // Получаем текущего пользователя
            const { data: { user } } = await window.supabase.auth.getUser();

            if (!user) {
                showNotification('🔒 Необходимо войти в систему для скачивания модов', 'error');
                showLoginModal();
                return;
            }

            console.log('✅ [SECURE DOWNLOAD] Пользователь авторизован:', user.email);

            // Сначала проверяем тип мода и получаем полную информацию
            const { data: mod, error: modError } = await window.supabase
                .from('mods')
                .select('id, name, is_private, category, download_url, file_path')
                .eq('id', modId)
                .single();

            if (modError || !mod) {
                throw new Error('Мод не найден');
            }

            console.log('🔍 [SECURE DOWNLOAD] Информация о моде:', {
                name: mod.name,
                is_private: mod.is_private,
                category: mod.category,
                has_file_path: !!mod.file_path,
                has_download_url: !!mod.download_url
            });

            // Проверяем, является ли мод VIP
            const isVipMod = mod.is_private === true || mod.category === 'vip_mods';

            if (isVipMod) {
                // ✅ VIP мод - используем защищенную ссылку через Edge Function
                console.log('💎 [SECURE DOWNLOAD] Это VIP мод, пробуем защищенную ссылку...');
                
                try {
                    const downloadData = await this.getSecureDownloadUrl(modId, user.id);

                    // Показываем уведомление о начале скачивания
                    showNotification(`📥 Начинаем скачивание мода: ${downloadData.modName}`, 'info');

                    // Показываем предупреждение о времени действия ссылки
                    const expiresText = downloadData.isExternalLink
                        ? '5 минут'
                        : '60 секунд';
                    showNotification(`🔐 Уникальная ссылка для вашего аккаунта. Действительна ${expiresText}. Не передавайте ссылку другим!`, 'warning', 10000);

                    // Создаем временную ссылку для скачивания
                    const downloadLink = document.createElement('a');
                    downloadLink.href = downloadData.downloadUrl;
                    downloadLink.target = '_blank';
                    downloadLink.rel = 'noopener noreferrer';
                    downloadLink.download = downloadData.modName || 'mod.zip';

                    document.body.appendChild(downloadLink);
                    downloadLink.click();
                    document.body.removeChild(downloadLink);

                    console.log('✅ [SECURE DOWNLOAD] VIP мод скачивается успешно');
                    setTimeout(() => {
                        showNotification(`✅ Мод "${downloadData.modName}" успешно скачивается!`, 'success');
                    }, 1000);
                } catch (edgeError) {
                    // ❌ Edge Function не работает - скачиваем напрямую
                    console.warn('⚠️ [SECURE DOWNLOAD] Edge Function недоступна, скачиваем напрямую:', edgeError);
                    
                    if (mod.download_url) {
                        console.log('🔗 [SECURE DOWNLOAD] Используем прямую внешнюю ссылку:', mod.download_url);
                        const downloadLink = document.createElement('a');
                        downloadLink.href = mod.download_url;
                        downloadLink.target = '_blank';
                        downloadLink.rel = 'noopener noreferrer';
                        
                        document.body.appendChild(downloadLink);
                        downloadLink.click();
                        document.body.removeChild(downloadLink);
                        
                        showNotification(`✅ Мод "${mod.name}" скачивается по прямой ссылке!`, 'success');
                    } else {
                        throw new Error('Нет файла для скачивания. Обратитесь к администратору.');
                    }
                }

            } else {
                // ✅ Обычный мод - скачиваем напрямую
                console.log('📦 [SECURE DOWNLOAD] Это обычный мод, скачиваем напрямую...');
                
                // Если есть внешняя ссылка
                if (mod.download_url) {
                    console.log('🔗 [SECURE DOWNLOAD] Используем внешнюю ссылку:', mod.download_url);
                    const downloadLink = document.createElement('a');
                    downloadLink.href = mod.download_url;
                    downloadLink.target = '_blank';
                    downloadLink.rel = 'noopener noreferrer';
                    
                    document.body.appendChild(downloadLink);
                    downloadLink.click();
                    document.body.removeChild(downloadLink);
                } 
                // Если есть файл в Storage
                else if (mod.file_path) {
                    const { data: { session } } = await window.supabase.auth.getSession();
                    const publicUrl = `${this.supabaseUrl}/storage/v1/object/public/mods/${mod.file_path}`;
                    
                    console.log('🔗 [SECURE DOWNLOAD] Используем публичную ссылку Storage:', publicUrl);
                    const downloadLink = document.createElement('a');
                    downloadLink.href = publicUrl;
                    downloadLink.target = '_blank';
                    downloadLink.rel = 'noopener noreferrer';
                    downloadLink.download = mod.name || 'mod.zip';
                    
                    document.body.appendChild(downloadLink);
                    downloadLink.click();
                    document.body.removeChild(downloadLink);
                }
                else {
                    throw new Error('Нет файла для скачивания. Обратитесь к администратору.');
                }

                showNotification(`✅ Мод "${mod.name}" успешно скачивается!`, 'success');
            }

        } catch (error) {
            console.error('❌ [SECURE DOWNLOAD] Ошибка скачивания:', error);
            showNotification(`❌ Ошибка скачивания: ${error.message}`, 'error');
        }
    }

    // Проверка статуса VIP мода
    async checkVipModAccess(modId) {
        try {
            // Получаем текущий токен пользователя
            const { data: { session } } = await window.supabase.auth.getSession();
            
            if (!session?.access_token) {
                return false;
            }

            const response = await fetch(`${this.supabaseUrl}/functions/v1/get-vip-download-link`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    modId: modId
                })
            });

            return response.ok;
        } catch (error) {
            console.error('❌ [SECURE DOWNLOAD] Ошибка проверки доступа:', error);
            return false;
        }
    }
}

// Создаем глобальный экземпляр
window.secureDownloadManager = new SecureDownloadManager();

// Экспортируем функции для совместимости
window.secureDownloadMod = async function(modId) {
    return await window.secureDownloadManager.downloadModSecure(modId);
};

window.checkVipAccess = async function(modId) {
    return await window.secureDownloadManager.checkVipModAccess(modId);
};

console.log('🔐 Менеджер защищенного скачивания загружен');
