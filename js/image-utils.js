// Модуль утилит изображений
// Сжатие, оптимизация и обработка изображений

class ImageProcessor {
    constructor() {
        this.maxWidth = 1920;
        this.maxHeight = 1080;
        this.quality = 0.85;
        this.maxFileSize = 2 * 1024 * 1024; // 2MB
    }

    // Сжатие изображения
    async compressImage(file, options = {}) {
        const opts = {
            maxWidth: options.maxWidth || this.maxWidth,
            maxHeight: options.maxHeight || this.maxHeight,
            quality: options.quality || this.quality,
            format: options.format || 'jpeg'
        };

        return new Promise((resolve, reject) => {
            if (!file.type.startsWith('image/')) {
                reject(new Error('Файл не является изображением'));
                return;
            }

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
                try {
                    // Рассчитываем новые размеры
                    const { width, height } = this.calculateDimensions(
                        img.width,
                        img.height,
                        opts.maxWidth,
                        opts.maxHeight
                    );

                    canvas.width = width;
                    canvas.height = height;

                    // Рисуем изображение с учетом ориентации
                    this.drawImageWithOrientation(ctx, img, width, height);

                    canvas.toBlob((blob) => {
                        if (!blob) {
                            reject(new Error('Не удалось создать blob'));
                            return;
                        }

                        // Проверяем размер файла
                        if (blob.size > this.maxFileSize) {
                            // Рекурсивно сжимаем с худшим качеством
                            opts.quality *= 0.8;
                            this.compressImage(file, opts)
                                .then(resolve)
                                .catch(reject);
                            return;
                        }

                        const compressedFile = new File([blob], file.name, {
                            type: `image/${opts.format}`,
                            lastModified: Date.now()
                        });

                        resolve({
                            file: compressedFile,
                            originalSize: file.size,
                            compressedSize: blob.size,
                            compressionRatio: (1 - blob.size / file.size) * 100
                        });
                    }, `image/${opts.format}`, opts.quality);
                } catch (error) {
                    reject(error);
                }
            };

            img.onerror = () => reject(new Error('Не удалось загрузить изображение'));

            // Создаем URL для файла
            const reader = new FileReader();
            reader.onload = (e) => {
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
            reader.readAsDataURL(file);
        });
    }

    // Расчет оптимальных размеров
    calculateDimensions(originalWidth, originalHeight, maxWidth, maxHeight) {
        let { width, height } = { width: originalWidth, height: originalHeight };

        if (width > height) {
            if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
            }
        } else {
            if (height > maxHeight) {
                width = (width * maxHeight) / height;
                height = maxHeight;
            }
        }

        return { width: Math.round(width), height: Math.round(height) };
    }

    // Рисование изображения с учетом ориентации
    drawImageWithOrientation(ctx, img, width, height) {
        ctx.save();
        ctx.drawImage(img, 0, 0, width, height);
        ctx.restore();
    }

    // Создание миниатюры
    async createThumbnail(file, size = 150) {
        try {
            const thumbnail = await this.compressImage(file, {
                maxWidth: size,
                maxHeight: size,
                quality: 0.7,
                format: 'jpeg'
            });

            return thumbnail.file;
        } catch (error) {
            console.warn('Ошибка создания миниатюры:', error);
            return null;
        }
    }

    // Конвертация в base64
    async fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Не удалось конвертировать в base64'));
            reader.readAsDataURL(file);
        });
    }

    // Конвертация из base64 в файл
    base64ToFile(base64String, filename) {
        const arr = base64String.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);

        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }

        return new File([u8arr], filename, { type: mime });
    }

    // Получение информации об изображении
    async getImageInfo(file) {
        return new Promise((resolve, reject) => {
            if (!file.type.startsWith('image/')) {
                reject(new Error('Файл не является изображением'));
                return;
            }

            const img = new Image();
            img.onload = () => {
                resolve({
                    width: img.width,
                    height: img.height,
                    aspectRatio: img.width / img.height,
                    fileSize: file.size,
                    fileName: file.name,
                    fileType: file.type
                });
            };

            img.onerror = () => reject(new Error('Не удалось загрузить изображение'));

            const reader = new FileReader();
            reader.onload = (e) => {
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
            reader.readAsDataURL(file);
        });
    }

    // Валидация изображения
    validateImage(file) {
        const errors = [];

        if (!file.type.startsWith('image/')) {
            errors.push('Файл не является изображением');
        }

        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            errors.push('Неподдерживаемый формат изображения');
        }

        if (file.size > 10 * 1024 * 1024) { // 10MB
            errors.push('Файл слишком большой (максимум 10MB)');
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    // Предварительный просмотр изображения
    createPreview(file, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return null;

        const preview = document.createElement('img');
        preview.className = 'image-preview';
        preview.style.maxWidth = '200px';
        preview.style.maxHeight = '200px';
        preview.style.objectFit = 'contain';

        const reader = new FileReader();
        reader.onload = (e) => {
            preview.src = e.target.result;
            container.appendChild(preview);
        };

        reader.readAsDataURL(file);
        return preview;
    }

    // Очистка preview контейнера
    clearPreview(containerId) {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = '';
        }
    }
}

// Глобальный экземпляр
const imageProcessor = new ImageProcessor();

// Глобальные функции для обратной совместимости
async function compressImage(file, options) {
    return await imageProcessor.compressImage(file, options);
}

async function createThumbnail(file, size) {
    return await imageProcessor.createThumbnail(file, size);
}

async function fileToBase64(file) {
    return await imageProcessor.fileToBase64(file);
}

function base64ToFile(base64String, filename) {
    return imageProcessor.base64ToFile(base64String, filename);
}

async function getImageInfo(file) {
    return await imageProcessor.getImageInfo(file);
}

function validateImage(file) {
    return imageProcessor.validateImage(file);
}

function createImagePreview(file, containerId) {
    return imageProcessor.createPreview(file, containerId);
}

function clearImagePreview(containerId) {
    return imageProcessor.clearPreview(containerId);
}

// Экспорт для модулей
window.imageProcessor = imageProcessor;
window.compressImage = compressImage;
window.createThumbnail = createThumbnail;
window.fileToBase64 = fileToBase64;
window.base64ToFile = base64ToFile;
window.getImageInfo = getImageInfo;
window.validateImage = validateImage;
window.createImagePreview = createImagePreview;
window.clearImagePreview = clearImagePreview;