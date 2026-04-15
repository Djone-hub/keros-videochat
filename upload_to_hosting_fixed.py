# -*- coding: utf-8 -*-
"""
Исправленный скрипт загрузки сайта на хостинг kerosmods.ru
"""

import os
import sys
import ftplib
import socket
from ftplib import FTP, error_perm

# ================= НАСТРОЙКИ FTP =================
FTP_HOST = "65.108.228.42"
FTP_USER = "keros492"
FTP_PASSWORD = "198029aaa@@29S"
FTP_PORT = 21

# Папка на хостинге куда загружать
REMOTE_DIR = "/domains/kerosmods.ru/public_html"

# Локальная папка с файлами сайта
LOCAL_DIR = os.path.dirname(os.path.abspath(__file__))

# Включить passive mode
PASSIVE_MODE = True

def test_connection():
    """Тест подключения к FTP"""
    print("🔍 Тест подключения к FTP...")
    try:
        # Проверяем доступность хоста
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(10)
        result = sock.connect_ex((FTP_HOST, FTP_PORT))
        sock.close()
        
        if result == 0:
            print("✅ Хост доступен")
        else:
            print(f"❌ Хост недоступен: {result}")
            return False
            
        # Пробуем подключиться к FTP
        ftp = FTP()
        ftp.connect(FTP_HOST, FTP_PORT, timeout=30)
        ftp.login(FTP_USER, FTP_PASSWORD)
        ftp.set_pasv(PASSIVE_MODE)
        ftp.quit()
        print("✅ FTP подключение успешно!")
        return True
        
    except Exception as e:
        print(f"❌ Ошибка подключения: {e}")
        return False

def main():
    # Включаем кодировку для Windows
    if sys.platform == 'win32':
        os.system('chcp 65001 > nul')
    
    print("=" * 60)
    print("🚀 ЗАГРУЗКА САЙТА НА kerosmods.ru")
    print("=" * 60)
    
    # Сначала тестируем подключение
    if not test_connection():
        print("\n❌ Не удалось подключиться к FTP!")
        print("🔧 Возможные решения:")
        print("   1. Проверьте интернет соединение")
        print("   2. Проверьте FTP данные (хост, пользователь, пароль)")
        print("   3. Проверьте что FTP порт 21 открыт")
        print("   4. Попробуйте другой режим (active/passive)")
        input("\nНажмите Enter для выхода...")
        return
    
    if not FTP_PASSWORD:
        print("\n[ERROR] Введите пароль в скрипте (строка 14)")
        input("Нажмите Enter для выхода...")
        return
    
    # Подключение к FTP
    print(f"\n🔌 Подключение к {FTP_HOST}:{FTP_PORT}...")
    ftp = None
    try:
        ftp = FTP()
        ftp.connect(FTP_HOST, FTP_PORT, timeout=30)
        ftp.login(FTP_USER, FTP_PASSWORD)
        ftp.set_pasv(PASSIVE_MODE)
        print("✅ Успешно подключено!")
    except Exception as e:
        print(f"[ERROR] Не удалось подключиться: {e}")
        input("Нажмите Enter для выхода...")
        return
    
    # Переходим в папку сайта
    print(f"\n📁 Переход в {REMOTE_DIR}...")
    try:
        ftp.cwd(REMOTE_DIR)
        print("✅ Папка найдена")
    except Exception as e:
        print(f"[ERROR] Не удалось найти папку: {e}")
        ftp.quit()
        input("Нажмите Enter для выхода...")
        return
    
    # Список файлов для загрузки
    files_to_upload = [
        "index.html",
        "script.js", 
        "script_head.js",
        "favicon.ico",
        "logo.png"
    ]
    
    # Список папок для загрузки
    folders_to_upload = ["css", "js", "logo", "supabase"]
    
    # Загружаем файлы
    print("\n📄 Загрузка файлов:")
    success_files = 0
    for filename in files_to_upload:
        local_path = os.path.join(LOCAL_DIR, filename)
        if os.path.exists(local_path):
            print(f"  📤 {filename}")
            try:
                with open(local_path, "rb") as f:
                    ftp.storbinary(f"STOR {filename}", f)
                print(f"     ✅ Загружен")
                success_files += 1
            except Exception as e:
                print(f"     ❌ {filename}: {e}")
        else:
            print(f"  ⚠️  {filename} не найден")
    
    # Загружаем папки
    print(f"\n📁 Загрузка папок:")
    success_folders = 0
    
    for folder in folders_to_upload:
        local_folder = os.path.join(LOCAL_DIR, folder)
        if os.path.isdir(local_folder):
            print(f"\n📂 {folder}/")
            
            # Создаем папку на сервере
            try:
                ftp.mkd(folder)
                print(f"  ✅ Папка создана")
            except error_perm:
                print(f"  ℹ️  Папка уже существует")
            except Exception as e:
                print(f"  ⚠️  Ошибка создания папки: {e}")
            
            try:
                ftp.cwd(folder)
            except Exception as e:
                print(f"  ❌ Не удалось перейти в папку: {e}")
                continue
            
            # Загружаем файлы из папки
            folder_files = 0
            for root, dirs, files in os.walk(local_folder):
                # Вычисляем относительный путь
                rel_path = os.path.relpath(root, local_folder)
                
                # Переходим в нужную папку
                if rel_path != ".":
                    subfolders = rel_path.split(os.sep)
                    for sf in subfolders:
                        try:
                            ftp.cwd(sf)
                        except error_perm:
                            try:
                                ftp.mkd(sf)
                                ftp.cwd(sf)
                            except:
                                pass
                
                # Загружаем файлы
                for file in files:
                    if file.endswith(".py"):
                        continue  # Пропускаем Python файлы
                    local_file = os.path.join(root, file)
                    print(f"    📤 {file}")
                    try:
                        with open(local_file, "rb") as f:
                            ftp.storbinary(f"STOR {file}", f)
                        folder_files += 1
                    except Exception as e:
                        print(f"    ❌ {file}: {e}")
                
                # Возвращаемся назад
                if rel_path != ".":
                    ftp.cwd("..")
                    for _ in range(len(rel_path.split(os.sep)) - 1):
                        try:
                            ftp.cwd("..")
                        except:
                            pass
            
            # Возвращаемся в корень
            ftp.cwd("..")
            success_folders += 1
            print(f"  ✅ Загружено файлов: {folder_files}")
    
    ftp.quit()
    
    print("\n" + "=" * 60)
    print(f"🎉 ЗАГРУЗКА ЗАВЕРШЕНА!")
    print(f"📄 Файлов загружено: {success_files}/{len(files_to_upload)}")
    print(f"📁 Папок загружено: {success_folders}/{len(folders_to_upload)}")
    print("=" * 60)
    print(f"\n🌐 Сайт доступен: https://kerosmods.ru")
    print()
    input("Нажмите Enter для выхода...")

if __name__ == "__main__":
    main()
