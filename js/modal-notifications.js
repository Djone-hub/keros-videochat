// Модуль для красивых модальных уведомлений
window.ModalNotification = {
    show: function(message, type = 'info') {
        // Удаляем существующее модальное окно если есть
        const existingModal = document.getElementById('custom-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // Цветовая схема для разных типов
        const colors = {
            success: { bg: 'rgba(76, 175, 80, 0.95)', border: '#4CAF50', icon: '✅' },
            error: { bg: 'rgba(244, 67, 54, 0.95)', border: '#f44336', icon: '❌' },
            warning: { bg: 'rgba(255, 152, 0, 0.95)', border: '#ff9800', icon: '⚠️' },
            info: { bg: 'rgba(33, 150, 243, 0.95)', border: '#2196F3', icon: 'ℹ️' }
        };

        const color = colors[type] || colors.info;

        // Создаем модальное окно
        const modalHTML = `
            <div id="custom-modal" style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 999999;
                animation: modalZoomIn 0.2s ease-out;
            ">
                <div style="
                    background: ${color.bg};
                    border: 2px solid ${color.border};
                    border-radius: 15px;
                    padding: 30px;
                    max-width: 500px;
                    width: 90%;
                    text-align: center;
                    color: white;
                    font-family: 'Courier New', monospace;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
                    animation: modalContentZoomIn 0.3s ease-out;
                ">
                    <div style="
                        font-size: 48px;
                        margin-bottom: 20px;
                    ">${color.icon}</div>
                    <div style="
                        font-size: 18px;
                        font-weight: bold;
                        margin-bottom: 15px;
                        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
                    ">${type.charAt(0).toUpperCase() + type.slice(1)}</div>
                    <div style="
                        font-size: 16px;
                        line-height: 1.5;
                        margin-bottom: 25px;
                    ">${message}</div>
                    <button onclick="ModalNotification.close()" style="
                        background: rgba(255, 255, 255, 0.2);
                        border: 1px solid rgba(255, 255, 255, 0.3);
                        color: white;
                        padding: 12px 30px;
                        border-radius: 25px;
                        cursor: pointer;
                        font-size: 16px;
                        font-weight: bold;
                        transition: all 0.3s ease;
                        backdrop-filter: blur(10px);
                    ">ОК</button>
                </div>
            </div>
        `;

        // Добавляем стили анимации
        const style = document.createElement('style');
        style.textContent = `
            /* ОТКЛЮЧАЕМ АНИМАЦИИ ДЛЯ ВСЕХ МОДАЛЬНЫХ ОКОН */
            .auth-modal,
            .vip-section-modal,
            .auth-content,
            #custom-modal,
            .ad-management-modal,
            .delete-user-modal,
            .safe-transfer-modal,
            .vip-modal,
            .admin-role-modal,
            .safe-delete-modal,
            .user-details-modal {
                animation: none !important;
                transition: none !important;
            }
            
            /* Новые анимации для модальных уведомлений */
            @keyframes modalZoomIn {
                from { 
                    opacity: 0; 
                    transform: scale(0.8); 
                }
                to { 
                    opacity: 1; 
                    transform: scale(1); 
                }
            }
            
            @keyframes modalContentZoomIn {
                from { 
                    opacity: 0; 
                    transform: scale(0.9); 
                }
                to { 
                    opacity: 1; 
                    transform: scale(1); 
                }
            }
            
            @keyframes modalZoomOut {
                from { 
                    opacity: 1; 
                    transform: scale(1); 
                }
                to { 
                    opacity: 0; 
                    transform: scale(0.8); 
                }
            }
            
            /* Перезаписываем старые анимации */
            @keyframes modalSlideIn {
                from { opacity: 1; transform: translateY(0) scale(1); }
                to { opacity: 1; transform: translateY(0) scale(1); }
            }
            @keyframes modalFadeIn {
                from { opacity: 1; }
                to { opacity: 1; }
            }
            @keyframes fadeIn {
                from { opacity: 1; }
                to { opacity: 1; }
            }
            @keyframes slideIn {
                from { transform: translateY(0); opacity: 1; }
                to { transform: translateY(0); opacity: 1; }
            }
            @keyframes slideInRight {
                from { opacity: 1; transform: translateX(0); }
                to { opacity: 1; transform: translateX(0); }
            }
            @keyframes slideOutRight {
                from { opacity: 1; transform: translateX(0); }
                to { opacity: 1; transform: translateX(0); }
            }
            @keyframes bounce {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(0); }
            }
        `;
        document.head.appendChild(style);

        // Добавляем модальное окно на страницу
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // НЕ закрываем автоматически - пользователь закроет сам
        // setTimeout(() => {
        //     this.close();
        // }, 5000);
    },

    close: function() {
        const modal = document.getElementById('custom-modal');
        if (modal) {
            // Добавляем анимацию удаления и для фона, и для содержимого
            modal.style.animation = 'modalZoomOut 0.3s ease-in';
            const content = modal.querySelector('div[style*="background"]');
            if (content) {
                content.style.animation = 'modalZoomOut 0.3s ease-in';
            }
            setTimeout(() => {
                modal.remove();
            }, 300);
        }
    }
};

// Добавляем стили для fadeOut
const fadeOutStyle = document.createElement('style');
fadeOutStyle.textContent = `
    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
`;
document.head.appendChild(fadeOutStyle);

// console.log('✅ Модуль модальных уведомлений загружен');
