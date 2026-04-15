/**
 * Единый красивый скроллинг для всех элементов сайта
 * Компактный зеленый скроллинг как в навигации
 */

// Стили для скроллингов
const scrollbarStyles = `
/* === ЕДИНЫЙ КОМПАКТНЫЙ СКРОЛЛИНГ ДЛЯ ВСЕХ ЭЛЕМЕНТОВ САЙТА === */

/* Универсальный скроллинг для всех элементов */
.admin-content-area::-webkit-scrollbar,
.admin-sidebar::-webkit-scrollbar,
.admin-nav-container::-webkit-scrollbar,
.main-nav::-webkit-scrollbar,
.modal-content::-webkit-scrollbar,
.admin-modal::-webkit-scrollbar,
.user-list::-webkit-scrollbar,
.banned-users::-webkit-scrollbar,
.audit-log::-webkit-scrollbar,
.log-container::-webkit-scrollbar,
.shop-content::-webkit-scrollbar,
.vip-shop::-webkit-scrollbar,
.settings-content::-webkit-scrollbar,
.admin-settings::-webkit-scrollbar,
.scrollable::-webkit-scrollbar,
.right-sidebar::-webkit-scrollbar,
.mod-categories::-webkit-scrollbar,
.mods-container::-webkit-scrollbar,
#modsContainer::-webkit-scrollbar {
    width: 8px;
    height: 8px;
}

.admin-content-area::-webkit-scrollbar-track,
.admin-sidebar::-webkit-scrollbar-track,
.admin-nav-container::-webkit-scrollbar-track,
.main-nav::-webkit-scrollbar-track,
.modal-content::-webkit-scrollbar-track,
.admin-modal::-webkit-scrollbar-track,
.user-list::-webkit-scrollbar-track,
.banned-users::-webkit-scrollbar-track,
.audit-log::-webkit-scrollbar-track,
.log-container::-webkit-scrollbar-track,
.shop-content::-webkit-scrollbar-track,
.vip-shop::-webkit-scrollbar-track,
.settings-content::-webkit-scrollbar-track,
.admin-settings::-webkit-scrollbar-track,
.scrollable::-webkit-scrollbar-track,
.right-sidebar::-webkit-scrollbar-track,
.mod-categories::-webkit-scrollbar-track,
.mods-container::-webkit-scrollbar-track,
#modsContainer::-webkit-scrollbar-track {
    background: linear-gradient(135deg, rgba(0, 255, 65, 0.1), rgba(0, 153, 38, 0.1));
    border-radius: 4px;
    border: 1px solid rgba(0, 255, 65, 0.2);
}

.admin-content-area::-webkit-scrollbar-thumb,
.admin-sidebar::-webkit-scrollbar-thumb,
.admin-nav-container::-webkit-scrollbar-thumb,
.main-nav::-webkit-scrollbar-thumb,
.modal-content::-webkit-scrollbar-thumb,
.admin-modal::-webkit-scrollbar-thumb,
.user-list::-webkit-scrollbar-thumb,
.banned-users::-webkit-scrollbar-thumb,
.audit-log::-webkit-scrollbar-thumb,
.log-container::-webkit-scrollbar-thumb,
.shop-content::-webkit-scrollbar-thumb,
.vip-shop::-webkit-scrollbar-thumb,
.settings-content::-webkit-scrollbar-thumb,
.admin-settings::-webkit-scrollbar-thumb,
.scrollable::-webkit-scrollbar-thumb,
.right-sidebar::-webkit-scrollbar-thumb,
.mod-categories::-webkit-scrollbar-thumb,
.mods-container::-webkit-scrollbar-thumb,
#modsContainer::-webkit-scrollbar-thumb {
    background: linear-gradient(135deg, #00ff41, #009926);
    border-radius: 4px;
    border: 1px solid rgba(0, 255, 65, 0.3);
    box-shadow: 0 0 6px rgba(0, 255, 65, 0.5);
    transition: all 0.3s ease;
}

.admin-content-area::-webkit-scrollbar-thumb:hover,
.admin-sidebar::-webkit-scrollbar-thumb:hover,
.admin-nav-container::-webkit-scrollbar-thumb:hover,
.main-nav::-webkit-scrollbar-thumb:hover,
.modal-content::-webkit-scrollbar-thumb:hover,
.admin-modal::-webkit-scrollbar-thumb:hover,
.user-list::-webkit-scrollbar-thumb:hover,
.banned-users::-webkit-scrollbar-thumb:hover,
.audit-log::-webkit-scrollbar-thumb:hover,
.log-container::-webkit-scrollbar-thumb:hover,
.shop-content::-webkit-scrollbar-thumb:hover,
.vip-shop::-webkit-scrollbar-thumb:hover,
.settings-content::-webkit-scrollbar-thumb:hover,
.admin-settings::-webkit-scrollbar-thumb:hover,
.scrollable::-webkit-scrollbar-thumb:hover,
.right-sidebar::-webkit-scrollbar-thumb:hover,
.mod-categories::-webkit-scrollbar-thumb:hover,
.mods-container::-webkit-scrollbar-thumb:hover,
#modsContainer::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(135deg, #00ff66, #00cc33);
    box-shadow: 0 0 8px rgba(0, 255, 102, 0.7);
    transform: scale(1.05);
}

/* Анимация появления скроллинга */
@keyframes scrollbarFadeIn {
    from {
        opacity: 0;
        transform: scaleX(0);
    }
    to {
        opacity: 1;
        transform: scaleX(1);
    }
}

/* Применяем анимацию ко всем скроллингам */
::-webkit-scrollbar {
    animation: scrollbarFadeIn 0.5s ease-out;
}

/* Мобильная адаптация */
@media (max-width: 767px) {
    .admin-content-area::-webkit-scrollbar,
    .admin-sidebar::-webkit-scrollbar,
    .admin-nav-container::-webkit-scrollbar,
    .main-nav::-webkit-scrollbar,
    .modal-content::-webkit-scrollbar,
    .admin-modal::-webkit-scrollbar,
    .user-list::-webkit-scrollbar,
    .banned-users::-webkit-scrollbar,
    .audit-log::-webkit-scrollbar,
    .log-container::-webkit-scrollbar,
    .shop-content::-webkit-scrollbar,
    .vip-shop::-webkit-scrollbar,
    .settings-content::-webkit-scrollbar,
    .admin-settings::-webkit-scrollbar,
    .scrollable::-webkit-scrollbar,
    .right-sidebar::-webkit-scrollbar,
    .mod-categories::-webkit-scrollbar,
    .mods-container::-webkit-scrollbar,
    #modsContainer::-webkit-scrollbar {
        width: 6px;
        height: 6px;
    }
}
`;

// Функция для добавления стилей
function addScrollbarStyles() {
    // Проверяем, есть ли уже наши стили
    if (document.getElementById('beautiful-scrollbar-styles')) {
        return;
    }
    
    // Создаем элемент стилей
    const styleElement = document.createElement('style');
    styleElement.id = 'beautiful-scrollbar-styles';
    styleElement.textContent = scrollbarStyles;
    
    // Добавляем в head
    document.head.appendChild(styleElement);
}

// Функция для добавления классов к контейнерам
function addScrollbarClasses() {
    // console.log('🎨 Добавляем классы для скроллингов...'); // Отключаем логи
    
    // Основной контент админ панели
    const contentArea = document.getElementById('admin-content-area');
    if (contentArea && !contentArea.classList.contains('admin-content-area')) {
        contentArea.classList.add('admin-content-area');
        // console.log('✅ Добавлен класс admin-content-area'); // Отключаем логи
    }
    
    // Навигация основного сайта
    const mainNav = document.querySelector('.main-nav');
    if (mainNav && !mainNav.classList.contains('main-nav')) {
        mainNav.classList.add('main-nav');
        // console.log('✅ Добавлен класс main-nav'); // Отключаем логи
    }
    
    // Боковая панель основного сайта
    const rightSidebar = document.querySelector('.right-sidebar');
    if (rightSidebar && !rightSidebar.classList.contains('right-sidebar')) {
        rightSidebar.classList.add('right-sidebar');
        // console.log('✅ Добавлен класс right-sidebar'); // Отключаем логи
    }
    
    // Категории модов
    const modCategories = document.querySelector('.mod-categories');
    if (modCategories && !modCategories.classList.contains('mod-categories')) {
        modCategories.classList.add('mod-categories');
        // console.log('✅ Добавлен класс mod-categories'); // Отключаем логи
    }
    
    // Контейнер модов
    const modsContainer = document.getElementById('modsContainer');
    if (modsContainer && !modsContainer.classList.contains('mods-container')) {
        modsContainer.classList.add('mods-container');
        // console.log('✅ Добавлен класс mods-container'); // Отключаем логи
    }
    
    // Боковая навигация - ищем все возможные варианты
    const sidebarSelectors = [
        '.admin-sidebar',
        '#admin-sidebar',
        '[style*="flex-direction: column"]',
        '[style*="overflow-y: auto"]',
        '.admin-nav-container'
    ];
    
    sidebarSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
            if (!element.classList.contains('admin-sidebar') && 
                element.style.overflowY === 'auto' && 
                element.style.flexDirection === 'column') {
                element.classList.add('admin-sidebar');
                // console.log('✅ Добавлен класс admin-sidebar к элементу:', selector); // Отключаем логи
            }
        });
    });
    
    // Все скролляемые элементы в админ панели
    const adminPanel = document.getElementById('admin-panel');
    if (adminPanel) {
        // Находим все элементы с overflow
        const scrollableElements = adminPanel.querySelectorAll('[style*="overflow"]');
        scrollableElements.forEach(element => {
            if (!element.classList.contains('scrollable') && 
                !element.classList.contains('admin-content-area') &&
                !element.classList.contains('admin-sidebar')) {
                element.classList.add('scrollable');
                // console.log('✅ Добавлен класс scrollable к скролляемому элементу'); // Отключаем логи
            }
        });
        
        // Находим контейнеры с контентом
        const contentContainers = adminPanel.querySelectorAll('[id*="content"], [id*="list"], [id*="container"]');
        contentContainers.forEach(element => {
            if (!element.classList.contains('scrollable') && 
                !element.classList.contains('admin-content-area')) {
                element.classList.add('scrollable');
                // console.log('✅ Добавлен класс scrollable к контейнеру:', element.id); // Отключаем логи
            }
        });
        
        // Находим все div с overflow-y: auto
        const overflowElements = adminPanel.querySelectorAll('div[style*="overflow-y: auto"]');
        overflowElements.forEach(element => {
            if (!element.classList.contains('scrollable') && 
                !element.classList.contains('admin-content-area') &&
                !element.classList.contains('admin-sidebar')) {
                element.classList.add('scrollable');
                // console.log('✅ Добавлен класс scrollable к элементу с overflow-y: auto'); // Отключаем логи
            }
        });
    }
    
    // Добавляем классы для всех модальных окон на сайте
    const allModals = document.querySelectorAll('[style*="position: fixed"], .modal, .modal-content');
    allModals.forEach(modal => {
        if (!modal.classList.contains('modal-content') && 
            modal.style.overflowY === 'auto' || 
            modal.style.maxHeight === '90vh') {
            modal.classList.add('modal-content');
            // console.log('✅ Добавлен класс modal-content к модальному окну'); // Отключаем логи
        }
    });
    
    // console.log('✅ Классы для скроллингов добавлены!'); // Отключаем логи
}

// Функция инициализации
function initBeautifulScrollbars() {
    
    // Добавляем стили
    addScrollbarStyles();
    
    // Добавляем классы
    addScrollbarClasses();
    
    // Наблюдаем за изменениями во всем документе для новых элементов
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                // Проверяем, есть ли новые элементы, которые нуждаются в классах
                let needsUpdate = false;
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) { // Element node
                        // Проверяем важные элементы
                        if (node.id === 'admin-content-area' || 
                            node.classList?.contains('modal') ||
                            node.querySelector?.('#admin-content-area') ||
                            node.querySelector?.('.modal')) {
                            needsUpdate = true;
                        }
                    }
                });
                
                if (needsUpdate) {
                    addScrollbarClasses();
                }
            }
        });
    });
    
    // Начинаем наблюдение за всем документом
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    // Повторная инициализация через секунду для динамических элементов
    setTimeout(() => {
        addScrollbarClasses();
    }, 1000);
    
    // Повторная инициализация через 3 секунды для всех элементов
    setTimeout(() => {
        addScrollbarClasses();
    }, 3000);
}

// Автоматическая инициализация при загрузке страницы
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBeautifulScrollbars);
} else {
    initBeautifulScrollbars();
}

// Экспортируем функции для использования в других скриптах
window.beautifulScrollbar = {
    init: initBeautifulScrollbars,
    addStyles: addScrollbarStyles,
    addClasses: addScrollbarClasses
};
