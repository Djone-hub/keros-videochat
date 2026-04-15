// Скрипт для глазиков паролей
function initPasswordEyes() {
    // Находим все глазики
    const eyeIcons = document.querySelectorAll('.password-toggle-icon');
    
    eyeIcons.forEach((eye, index) => {
        // Удаляем старые обработчики
        const newEye = eye.cloneNode(true);
        eye.parentNode.replaceChild(newEye, eye);
        
        // Находим связанный input
        const wrapper = newEye.closest('.password-wrapper, .input-wrapper');
        const input = wrapper ? wrapper.querySelector('input[type="password"], input[type="text"]') : null;
        
        if (!input) {
            return;
        }
        
        // Добавляем обработчик
        newEye.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            if (input.type === 'password') {
                // Показываем пароль
                input.type = 'text';
                input.setAttribute('data-password-visible', 'true');
                input.style.webkitTextSecurity = 'none';
                input.style.fontFamily = 'inherit';
                newEye.textContent = '🙈';
                newEye.title = 'Скрыть пароль';
                newEye.style.background = '#4CAF50';
            } else {
                // Скрываем пароль
                input.type = 'password';
                input.setAttribute('data-password-visible', 'false');
                input.style.webkitTextSecurity = 'disc';
                input.style.fontFamily = 'monospace';
                newEye.textContent = '👁️';
                newEye.title = 'Показать пароль';
                newEye.style.background = '#666';
            }
        });
        
        // Устанавливаем начальное состояние
        newEye.title = 'Показать пароль';
        newEye.style.cursor = 'pointer';
        newEye.style.background = '#666';
    });
    
    // Добавляем глобальные CSS стили
    const style = document.createElement('style');
    style.textContent = `
        /* Стили только для полей паролей */
        .password-wrapper .password-toggle-icon {
            cursor: pointer !important;
            user-select: none !important;
            transition: background 0.3s ease !important;
        }
        
        /* Применяем стили только к полям внутри password-wrapper */
        .password-wrapper input[type="text"][data-password-visible="true"] {
            -webkit-text-security: none !important;
            font-family: inherit !important;
        }
        
        .password-wrapper input[type="password"][data-password-visible="false"],
        .password-wrapper input[type="text"]:not([data-password-visible="true"]) {
            -webkit-text-security: disc !important;
            font-family: monospace !important;
        }
        
        /* НЕ применяем стили к другим полям */
        input:not(.password-wrapper input) {
            -webkit-text-security: none !important;
            font-family: inherit !important;
        }
    `;
    document.head.appendChild(style);
}

// Запускаем несколько раз для надежности
initPasswordEyes();
setTimeout(initPasswordEyes, 500);
setTimeout(initPasswordEyes, 1000);
setTimeout(initPasswordEyes, 2000);

// Также при открытии модальных окон
const originalShowLoginModal = window.showLoginModal;
const originalShowRegisterModal = window.showRegisterModal;

if (typeof showLoginModal === 'function') {
    window.showLoginModal = function() {
        originalShowLoginModal.apply(this, arguments);
        setTimeout(initPasswordEyes, 100);
    };
}

if (typeof showRegisterModal === 'function') {
    window.showRegisterModal = function() {
        originalShowRegisterModal.apply(this, arguments);
        setTimeout(initPasswordEyes, 100);
    };
}

// Глобальная функция
window.initPasswordEyes = initPasswordEyes;
