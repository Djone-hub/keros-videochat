# -*- coding: utf-8 -*-
"""
Тест и загрузка сайта на хостинг kerosmods.ru
"""

import socket
import ftplib
import time

def test_ftp_connection(host, port, user, password):
    """Тест подключения к FTP"""
    print(f"🔍 Тест подключения к {host}:{port}")
    
    try:
        # 1. Тест доступности хоста
        print("  📍 Проверка доступности хоста...")
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(10)
        result = sock.connect_ex((host, port))
        sock.close()
        
        if result == 0:
            print("  ✅ Хост доступен")
        else:
            print(f"  ❌ Хост недоступен (код: {result})")
            return False, "Хост недоступен"
        
        # 2. Тест FTP подключения
        print("  🔌 Проверка FTP подключения...")
        ftp = ftplib.FTP()
        ftp.connect(host, port, timeout=30)
        ftp.login(user, password)
        print("  ✅ FTP подключение успешно!")
        
        # 3. Проверка папки
        print("  📁 Проверка папки сайта...")
        ftp.cwd("/domains/kerosmods.ru/public_html")
        print("  ✅ Папка найдена")
        
        ftp.quit()
        return True, "Подключение успешно"
        
    except socket.timeout:
        return False, "Таймаут подключения"
    except socket.gaierror:
        return False, "Не удалось разрешить имя хоста"
    except ftplib.error_perm as e:
        return False, f"Ошибка прав доступа: {e}"
    except Exception as e:
        return False, f"Ошибка подключения: {e}"

def main():
    print("=" * 60)
    print("🌐 ТЕСТ ПОДКЛЮЧЕНИЯ К kerosmods.ru")
    print("=" * 60)
    
    # Разные варианты настроек
    configs = [
        {
            "name": "Основные настройки",
            "host": "65.108.228.42",
            "port": 21,
            "user": "keros492",
            "password": "198029aaa@@29S"
        },
        {
            "name": "Альтернативный порт",
            "host": "65.108.228.42", 
            "port": 22,
            "user": "keros492",
            "password": "198029aaa@@29S"
        },
        {
            "name": "Пассивный режим",
            "host": "65.108.228.42",
            "port": 21,
            "user": "keros492", 
            "password": "198029aaa@@29S"
        }
    ]
    
    for config in configs:
        print(f"\n🔧 Тест: {config['name']}")
        print("-" * 40)
        
        success, message = test_ftp_connection(
            config['host'],
            config['port'], 
            config['user'],
            config['password']
        )
        
        if success:
            print(f"  🎉 УСПЕХ: {message}")
            print("\n✅ Используйте эти настройки для загрузки!")
            
            # Сохраняем рабочие настройки
            with open('working_ftp_config.py', 'w', encoding='utf-8') as f:
                f.write(f'''# Рабочие FTP настройки
FTP_HOST = "{config['host']}"
FTP_PORT = {config['port']}
FTP_USER = "{config['user']}"
FTP_PASSWORD = "{config['password']}"
REMOTE_DIR = "/domains/kerosmods.ru/public_html"
PASSIVE_MODE = True
''')
            print("💾 Настройки сохранены в working_ftp_config.py")
            break
        else:
            print(f"  ❌ ОШИБКА: {message}")
    
    print("\n" + "=" * 60)
    print("🏁 Тест завершен!")
    
    if not success:
        print("\n🔧 Рекомендации:")
        print("  1. Проверьте FTP данные у хостинг-провайдера")
        print("  2. Проверьте что сайт работает: https://kerosmods.ru")
        print("  3. Попробуйте другой FTP клиент (FileZilla)")
        print("  4. Проверьте фаервол/антивирус")
    
    input("\nНажмите Enter для выхода...")

if __name__ == "__main__":
    main()
