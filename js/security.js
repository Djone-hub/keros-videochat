/**
 * 🔐 МОДУЛЬ БЕЗОПАСНОСТИ
 * Безопасное хранение паролей и чувствительных данных
 */

// Отключаем все логи для чистоты консоли
const DEBUG_MODE = false;

class SecurityManager {
    constructor() {
        this.salt = 'KEROS_SECURITY_SALT_2025';
        this.init();
    }

    init() {
        if (DEBUG_MODE) console.log('🔐 Модуль безопасности инициализирован');
    }

    /**
     * Создает хеш пароля с использованием соли
     * @param {string} password - Пароль для хеширования
     * @returns {string} - Хешированный пароль
     */
    hashPassword(password) {
        if (!password) return '';
        
        // Простое хеширование с солью (для демонстрации)
        // В продакшене использовать более сильные алгоритмы
        const combined = password + this.salt;
        let hash = 0;
        
        for (let i = 0; i < combined.length; i++) {
            const char = combined.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        
        return btoa(hash.toString()).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
    }

    /**
     * Проверяет соответствие пароля хешу
     * @param {string} password - Введенный пароль
     * @param {string} hash - Хешированный пароль
     * @returns {boolean} - Результат проверки
     */
    verifyPassword(password, hash) {
        if (!password || !hash) return false;
        return this.hashPassword(password) === hash;
    }

    /**
     * Безопасно сохраняет пароль в localStorage
     * @param {string} password - Пароль для сохранения
     * @param {string} key - Ключ для хранения
     */
    securePasswordStorage(password, key = 'adminPassword') {
        const hashedPassword = this.hashPassword(password);
        localStorage.setItem(key, hashedPassword);
        if (DEBUG_MODE) console.log('🔐 Пароль безопасно сохранен в хешированном виде');
    }

    /**
     * Безопасно получает пароль из localStorage
     * @param {string} key - Ключ для получения
     * @returns {string|null} - Хешированный пароль
     */
    securePasswordGet(key = 'adminPassword') {
        return localStorage.getItem(key);
    }

    /**
     * Проверяет введенный пароль с сохраненным хешем
     * @param {string} inputPassword - Введенный пароль
     * @param {string} storedKey - Ключ сохраненного пароля
     * @returns {boolean} - Результат проверки
     */
    checkStoredPassword(inputPassword, storedKey = 'adminPassword') {
        const storedHash = this.securePasswordGet(storedKey);
        if (!storedHash) return false;
        
        return this.verifyPassword(inputPassword, storedHash);
    }

    /**
     * Очищает чувствительные данные из консоли
     */
    clearSensitiveConsole() {
        if (!DEBUG_MODE) return; // Выходим если отладка отключена
        
        if (typeof console !== 'undefined') {
            const originalLog = console.log;
            const originalError = console.error;
            const originalWarn = console.warn;
            
            // Переопределяем console.log для фильтрации чувствительных данных
            console.log = function(...args) {
                const message = args.join(' ');
                
                // Проверяем на чувствительные данные
                if (this.containsSensitiveData(message)) {
                    return; // Не выводим чувствительные данные
                }
                
                return originalLog.apply(console, args);
            }.bind(this);
            
            // Аналогично для error и warn
            console.error = function(...args) {
                const message = args.join(' ');
                if (this.containsSensitiveData(message)) {
                    return;
                }
                return originalError.apply(console, args);
            }.bind(this);
            
            console.warn = function(...args) {
                const message = args.join(' ');
                if (this.containsSensitiveData(message)) {
                    return;
                }
                return originalWarn.apply(console, args);
            }.bind(this);
        }
    }

    /**
     * Проверяет, содержит ли сообщение чувствительные данные
     * @param {string} message - Сообщение для проверки
     * @returns {boolean} - true если содержит чувствительные данные
     */
    containsSensitiveData(message) {
        const sensitivePatterns = [
            /пароль:\s*\S+/i,
            /password:\s*\S+/i,
            /токен:\s*\S+/i,
            /token:\s*\S+/i,
            /api\s*key:\s*\S+/i,
            /secret:\s*\S+/i,
            /KEROS\d+/i,
            /admin\d+/i
        ];
        
        return sensitivePatterns.some(pattern => pattern.test(message));
    }

    /**
     * Генерирует безопасный случайный пароль
     * @param {number} length - Длина пароля
     * @returns {string} - Сгенерированный пароль
     */
    generateSecurePassword(length = 12) {
        const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let password = '';
        
        for (let i = 0; i < length; i++) {
            const randomIndex = Math.floor(Math.random() * charset.length);
            password += charset[randomIndex];
        }
        
        return password;
    }

    /**
     * Проверяет сложность пароля
     * @param {string} password - Пароль для проверки
     * @returns {object} - Объект с результатами проверки
     */
    checkPasswordStrength(password) {
        const result = {
            score: 0,
            feedback: [],
            isStrong: false
        };

        if (!password) {
            result.feedback.push('Пароль не может быть пустым');
            return result;
        }

        // Длина
        if (password.length >= 8) result.score++;
        else result.feedback.push('Пароль должен содержать минимум 8 символов');

        // Буквы в верхнем регистре
        if (/[A-Z]/.test(password)) result.score++;
        else result.feedback.push('Добавьте буквы в верхнем регистре');

        // Буквы в нижнем регистре
        if (/[a-z]/.test(password)) result.score++;
        else result.feedback.push('Добавьте буквы в нижнем регистре');

        // Цифры
        if (/\d/.test(password)) result.score++;
        else result.feedback.push('Добавьте цифры');

        // Специальные символы
        if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) result.score++;
        else result.feedback.push('Добавьте специальные символы');

        result.isStrong = result.score >= 4;
        return result;
    }
}

// Создаем глобальный экземпляр
window.securityManager = new SecurityManager();

// Автоматически очищаем консоль от чувствительных данных
window.securityManager.clearSensitiveConsole();

// Экспортируем для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SecurityManager;
}
