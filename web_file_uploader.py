# -*- coding: utf-8 -*-
"""
Автоматическая загрузка файлов сайта на S3 хостинг
https://s3.nska.net:2222/index.php?dir=KEROS_MODS_2025
"""

import os
import sys
import requests
import mimetypes
from pathlib import Path

# ================= НАСТРОЙКИ =================
UPLOAD_URL = "https://s3.nska.net:2222/index.php"
LOCAL_DIR = os.path.dirname(os.path.abspath(__file__))
TARGET_DIR = "KEROS_MODS_2025"

def upload_file(file_path, target_path=None):
    """Загрузка одного файла"""
    if not os.path.exists(file_path):
        print(f"❌ Файл не найден: {file_path}")
        return False
    
    filename = os.path.basename(file_path)
    if target_path:
        full_target = f"{TARGET_DIR}/{target_path}/{filename}"
    else:
        full_target = f"{TARGET_DIR}/{filename}"
    
    print(f"📤 Загрузка: {filename} -> {full_target}")
    
    try:
        with open(file_path, 'rb') as f:
            files = {
                'file': (filename, f, mimetypes.guess_type(filename) or 'application/octet-stream')
            }
            
            data = {
                'dir': TARGET_DIR,
                'path': os.path.dirname(full_target) if target_path else '',
                'submit': 'Upload'
            }
            
            response = requests.post(UPLOAD_URL, files=files, data=data, timeout=60)
            
            if response.status_code == 200:
                print(f"  ✅ Успешно загружен")
                return True
            else:
                print(f"  ❌ Ошибка: {response.status_code}")
                print(f"  Ответ: {response.text[:200]}")
                return False
                
    except Exception as e:
        print(f"  ❌ Ошибка загрузки: {e}")
        return False

def upload_directory():
    """Загрузка всех файлов проекта"""
    print("=" * 60)
    print("🚀 ЗАГРУЗКА САЙТА НА S3 ХОСТИНГ")
    print("=" * 60)
    print(f"📁 Локальная папка: {LOCAL_DIR}")
    print(f"🌐 Целевая папка: {TARGET_DIR}")
    print(f"🔗 URL загрузки: {UPLOAD_URL}")
    print("=" * 60)
    
    success_count = 0
    total_count = 0
    
    # Основные файлы
    main_files = [
        "index.html",
        "script.js",
        "script_head.js", 
        "favicon.ico",
        "logo.png"
    ]
    
    print("\n📄 Загрузка основных файлов:")
    for filename in main_files:
        file_path = os.path.join(LOCAL_DIR, filename)
        if os.path.exists(file_path):
            total_count += 1
            if upload_file(file_path):
                success_count += 1
        else:
            print(f"  ⚠️  {filename} - не найден")
    
    # Папки
    folders = ["css", "js", "logo", "supabase"]
    
    for folder in folders:
        folder_path = os.path.join(LOCAL_DIR, folder)
        if os.path.isdir(folder_path):
            print(f"\n📁 Загрузка папки/{folder}:")
            
            for root, dirs, files in os.walk(folder_path):
                for file in files:
                    if file.endswith('.py'):  # Пропускаем Python файлы
                        continue
                    
                    file_path = os.path.join(root, file)
                    relative_path = os.path.relpath(file_path, folder_path)
                    target_path = f"{folder}/{relative_path}"
                    
                    total_count += 1
                    if upload_file(file_path, target_path):
                        success_count += 1
    
    # Результаты
    print("\n" + "=" * 60)
    print("📊 РЕЗУЛЬТАТЫ ЗАГРУЗКИ:")
    print(f"📤 Загружено файлов: {success_count}/{total_count}")
    print(f"📁 Создано папок: {len(folders)}")
    
    if success_count == total_count:
        print("✅ ВСЕ ФАЙЛЫ УСПЕШНО ЗАГРУЖЕНЫ!")
        print(f"🌐 Сайт доступен: https://s3.nska.net:2222/{TARGET_DIR}/")
    else:
        print(f"⚠️  Загружено {success_count} из {total_count} файлов")
        print("🔧 Проверьте ошибки выше")
    
    print("=" * 60)
    print("🎉 ЗАГРУЗКА ЗАВЕРШЕНА!")
    print()
    input("Нажмите Enter для выхода...")

def test_connection():
    """Тест подключения к хостингу"""
    print("🔍 Тест подключения к хостингу...")
    
    try:
        response = requests.get(UPLOAD_URL, timeout=30)
        if response.status_code == 200:
            print("✅ Хостинг доступен")
            return True
        else:
            print(f"❌ Хостинг недоступен: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Ошибка подключения: {e}")
        return False

def main():
    # Включаем кодировку для Windows
    if sys.platform == 'win32':
        os.system('chcp 65001 > nul')
    
    # Тест подключения
    if not test_connection():
        print("\n❌ Не удалось подключиться к хостингу!")
        print("🔧 Проверьте:")
        print("   1. Интернет соединение")
        print("   2. Доступность сайта: https://s3.nska.net:2222")
        print("   3. Правильность URL загрузки")
        input("\nНажмите Enter для выхода...")
        return
    
    # Спрашиваем подтверждение
    print(f"\n📁 Будут загружены файлы из:")
    print(f"   {LOCAL_DIR}")
    print(f"\n🌐 На хостинг в папку:")
    print(f"   {TARGET_DIR}")
    
    confirm = input("\nПродолжить загрузку? (y/n): ").lower().strip()
    if confirm not in ['y', 'yes', 'д']:
        print("❌ Загрузка отменена")
        return
    
    # Загрузка
    upload_directory()

if __name__ == "__main__":
    main()
