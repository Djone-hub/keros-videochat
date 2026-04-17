# Деплой Keros VideoChat на любой сервер

## Быстрый деплой

### 1. Подготовка переменных окружения

Скопируйте `.env.example` в `.env` и заполните:

```bash
cp .env.example .env
```

Отредактируйте `.env`:
```
NODE_ENV=production
PORT=10000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key
```

### 2. Docker деплой (рекомендуется)

```bash
# Сборка образа
docker build -t keros-videochat .

# Запуск
docker run -p 10000:10000 --env-file .env keros-videochat
```

Или с docker-compose:
```bash
docker-compose up -d
```

---

## Деплой на российские серверы

### Яндекс Клауд (Yandex Cloud)

1. **Регистрация:** https://cloud.yandex.ru/
2. **Создайте VM:**
   - Выберите "Compute Cloud"
   - "Создать виртуальную машину"
   - Выберите регион: Россия (Москва или Санкт-Петербург)
   - Образ: Ubuntu 22.04
   - Конфигурация: 2 vCPU, 2 GB RAM (бесплатный кредит покроет)

3. **Подключитесь к VM:**
   ```bash
   ssh ubuntu@your-vm-ip
   ```

4. **Установите Docker:**
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker ubuntu
   ```

5. **Клонируйте репозиторий:**
   ```bash
   git clone https://github.com/Djone-hub/keros-videochat.git
   cd keros-videochat/videochat
   ```

6. **Создайте .env файл:**
   ```bash
   nano .env
   ```
   Вставьте ваши переменные окружения

7. **Запустите:**
   ```bash
   docker-compose up -d
   ```

8. **Настройте SSL (Let's Encrypt):**
   ```bash
   sudo apt install certbot
   sudo certbot certonly --standalone -d your-domain.ru
   ```

---

### VK Cloud (Cloud.ru)

1. **Регистрация:** https://cloud.ru/
2. Создайте VM с Ubuntu 22.04
3. Следуйте шагам 3-7 из Яндекс Клауд выше

---

### Timeweb Cloud

1. **Регистрация:** https://timeweb.cloud/
2. Создайте VPS с Ubuntu 22.04
3. Следуйте шагам 3-7 из Яндекс Клауд выше

---

### Selectel

1. **Регистрация:** https://selectel.ru/
2. Создайте сервер с Ubuntu 22.04
3. Следуйте шагам 3-7 из Яндекс Клауд выше

---

## Деплой на Render (текущий)

Если Render заблокирует, быстро переключитесь на любой из вышеперечисленных.

---

## Проверка деплоя

После деплоя проверьте:
```bash
curl http://your-server-ip:10000
```

Должен вернуть HTML страницы.

---

## Переключение домена

Если нужно переключить домен:
1. Обновите DNS записи
2. Настройте SSL сертификат
3. Перезапустите контейнер

---

## Резервное копирование

Supabase автоматически резервирует данные. Для дополнительной безопасности:

```bash
# Экспорт данных из Supabase
pg_dump -h your-project.supabase.co -U postgres -d postgres > backup.sql
```

---

## Скорость переключения

С Docker конфигурацией:
- **Яндекс Клауд:** 15-20 минут
- **VK Cloud:** 15-20 минут
- **Timeweb:** 10-15 минут
- **Selectel:** 10-15 минут

Без Docker:
- Любая платформа: 30-40 минут

---

## Поддержка

Если нужна помощь с деплоем на конкретную платформу - сообщите!
