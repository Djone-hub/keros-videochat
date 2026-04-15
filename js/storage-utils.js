// Модуль утилит хранилища
// Управление localStorage и sessionStorage с резервным копированием

class StorageManager {
    constructor() {
        this.prefix = 'keros_site_';
        this.maxBackups = 5;
        this.quotaLimit = 4.5 * 1024 * 1024; // 4.5MB
    }

    // Безопасная установка в localStorage
    setLocalStorage(key, value) {
        try {
            const serializedValue = JSON.stringify(value);
            localStorage.setItem(this.prefix + key, serializedValue);

            // Создаем бэкап
            this.createBackup(key, value);
            return true;
        } catch (error) {
            console.warn('Ошибка записи в localStorage:', error);
            if (error.name === 'QuotaExceededError') {
                this.cleanupOldData();
                try {
                    localStorage.setItem(this.prefix + key, JSON.stringify(value));
                    return true;
                } catch (retryError) {
                    console.error('Не удалось записать даже после очистки:', retryError);
                    return false;
                }
            }
            return false;
        }
    }

    // Безопасное получение из localStorage
    getLocalStorage(key) {
        try {
            const value = localStorage.getItem(this.prefix + key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            console.warn('Ошибка чтения из localStorage:', error);
            return null;
        }
    }

    // Установка в sessionStorage
    setSessionStorage(key, value) {
        try {
            const serializedValue = JSON.stringify(value);
            sessionStorage.setItem(this.prefix + key, serializedValue);
            return true;
        } catch (error) {
            console.warn('Ошибка записи в sessionStorage:', error);
            return false;
        }
    }

    // Получение из sessionStorage
    getSessionStorage(key) {
        try {
            const value = sessionStorage.getItem(this.prefix + key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            console.warn('Ошибка чтения из sessionStorage:', error);
            return null;
        }
    }

    // Создание резервной копии
    createBackup(key, value) {
        const backupKey = `backup_${key}_${Date.now()}`;
        try {
            localStorage.setItem(this.prefix + backupKey, JSON.stringify({
                key: key,
                value: value,
                timestamp: Date.now()
            }));
            this.cleanupOldBackups(key);
        } catch (error) {
            console.warn('Ошибка создания бэкапа:', error);
        }
    }

    // Восстановление из резервной копии
    restoreFromBackup(key) {
        try {
            const backupKeys = Object.keys(localStorage)
                .filter(k => k.startsWith(this.prefix + 'backup_' + key + '_'))
                .sort()
                .reverse();

            for (const backupKey of backupKeys) {
                const backup = JSON.parse(localStorage.getItem(backupKey));
                if (backup && backup.key === key) {
                    this.setLocalStorage(key, backup.value);
                    return backup.value;
                }
            }
        } catch (error) {
            console.warn('Ошибка восстановления из бэкапа:', error);
        }
        return null;
    }

    // Очистка старых бэкапов
    cleanupOldBackups(key) {
        try {
            const backupKeys = Object.keys(localStorage)
                .filter(k => k.startsWith(this.prefix + 'backup_' + key + '_'))
                .sort()
                .reverse();

            if (backupKeys.length > this.maxBackups) {
                const keysToDelete = backupKeys.slice(this.maxBackups);
                keysToDelete.forEach(k => localStorage.removeItem(k));
            }
        } catch (error) {
            console.warn('Ошибка очистки старых бэкапов:', error);
        }
    }

    // Очистка старых данных
    cleanupOldData() {
        try {
            const keys = Object.keys(localStorage);
            const currentTime = Date.now();
            const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 дней

            keys.forEach(key => {
                if (key.startsWith(this.prefix + 'backup_')) {
                    try {
                        const backup = JSON.parse(localStorage.getItem(key));
                        if (backup && currentTime - backup.timestamp > maxAge) {
                            localStorage.removeItem(key);
                        }
                    } catch (error) {
                        // Удаляем поврежденные бэкапы
                        localStorage.removeItem(key);
                    }
                }
            });
        } catch (error) {
            console.warn('Ошибка очистки старых данных:', error);
        }
    }

    // Получение размера хранилища
    getStorageSize() {
        try {
            let total = 0;
            for (const key in localStorage) {
                if (key.startsWith(this.prefix)) {
                    total += localStorage.getItem(key).length + key.length;
                }
            }
            return total;
        } catch (error) {
            console.warn('Ошибка получения размера хранилища:', error);
            return 0;
        }
    }

    // Очистка всего хранилища сайта
    clearAll() {
        try {
            const keys = Object.keys(localStorage).filter(k => k.startsWith(this.prefix));
            keys.forEach(key => localStorage.removeItem(key));
            return true;
        } catch (error) {
            console.warn('Ошибка очистки хранилища:', error);
            return false;
        }
    }
}

// Глобальный экземпляр
const storageManager = new StorageManager();

// Глобальные функции для обратной совместимости
function saveToLocalStorage(key, value) {
    return storageManager.setLocalStorage(key, value);
}

function loadFromLocalStorage(key) {
    return storageManager.getLocalStorage(key);
}

function saveToSessionStorage(key, value) {
    return storageManager.setSessionStorage(key, value);
}

function loadFromSessionStorage(key) {
    return storageManager.getSessionStorage(key);
}

function restoreDataFromBackup(key) {
    return storageManager.restoreFromBackup(key);
}

function clearAllSiteData() {
    return storageManager.clearAll();
}

// Экспорт для модулей
window.storageManager = storageManager;
window.saveToLocalStorage = saveToLocalStorage;
window.loadFromLocalStorage = loadFromLocalStorage;
window.saveToSessionStorage = saveToSessionStorage;
window.loadFromSessionStorage = loadFromSessionStorage;
window.restoreDataFromBackup = restoreDataFromBackup;
window.clearAllSiteData = clearAllSiteData;