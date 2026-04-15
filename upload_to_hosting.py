# -*- coding: utf-8 -*-
"""
Skript zagruzki sayta na hosting cherez FTP
kerosmods.ru
"""

import os
import sys
from ftplib import FTP, error_perm

# ================= NASTROYKI FTP =================
FTP_HOST = "65.108.228.42"
FTP_USER = "keros492"
FTP_PASSWORD = "198029aaa@@29S"
FTP_PORT = 21

# Papka na hostinge kuda zagruzhat
REMOTE_DIR = "/domains/kerosmods.ru/public_html"

# Lokal'naya papka s faylami sayta
LOCAL_DIR = os.path.dirname(os.path.abspath(__file__))

# Vklyuchit passive mode
PASSIVE_MODE = False

def main():
    # Vklyuchaem kodirovku dlya Windows
    if sys.platform == 'win32':
        os.system('chcp 65001 > nul')
    
    print("=" * 50)
    print("Zagruzka sayta na kerosmods.ru")
    print("=" * 50)
    
    if not FTP_PASSWORD:
        print("\n[ERROR] Vpishite parol v skript (stroka 15)")
        input("Nazhmite Enter dlya vykhoda...")
        return
    
    # Podkluchenie k FTP
    print(f"\nPodkluchenie k {FTP_HOST}:{FTP_PORT}...")
    ftp = None
    try:
        ftp = FTP()
        ftp.connect(FTP_HOST, FTP_PORT, timeout=30)
        ftp.login(FTP_USER, FTP_PASSWORD)
        ftp.set_pasv(PASSIVE_MODE)
        print("[OK] Uspeshno podklucheno!")
    except Exception as e:
        print(f"[ERROR] Ne udalos podkluchitsya: {e}")
        input("Nazhmite Enter dlya vykhoda...")
        return
    
    # Perekhodim v papku sayta
    print(f"\nPerekhod v {REMOTE_DIR}...")
    try:
        ftp.cwd(REMOTE_DIR)
        print("[OK] Papka naydena")
    except Exception as e:
        print(f"[ERROR] Ne udalos nayti papku: {e}")
        ftp.quit()
        input("Nazhmite Enter dlya vykhoda...")
        return
    
    # Spisok faylov dlya zagruzki
    files_to_upload = [
        "index.html",
        "script.js",
        "script_head.js",
        "favicon.ico",
        "logo.png"
    ]
    
    folders_to_upload = ["css", "js", "logo", "supabase"]
    
    # Zagruzhaem faylov
    print("\n[ZAGRUZKA] Faylov:")
    for filename in files_to_upload:
        local_path = os.path.join(LOCAL_DIR, filename)
        if os.path.exists(local_path):
            print(f"  -> {filename}")
            try:
                with open(local_path, "rb") as f:
                    ftp.storbinary(f"STOR {filename}", f)
                print(f"     [OK] Zagruzhen")
            except Exception as e:
                print(f"  [ERROR] {filename}: {e}")
        else:
            print(f"  [WARN] {filename} ne nayden")
    
    # Zagruzhaem papki
    for folder in folders_to_upload:
        local_folder = os.path.join(LOCAL_DIR, folder)
        if os.path.isdir(local_folder):
            print(f"\n[DIR] {folder}/")
            
            # Sozdayom papku na servere
            try:
                ftp.mkd(folder)
                print(f"  [OK] Papka sozdana")
            except error_perm:
                print(f"  [INFO] Papka uzhe sushchestvuet")
            
            ftp.cwd(folder)
            
            # Zagruzhaem faylov iz papki
            for root, dirs, files in os.walk(local_folder):
                # Vychislyaem otnositelny put
                rel_path = os.path.relpath(root, local_folder)
                
                # Perkhodim v nuzhnuyu papku
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
                
                # Zagruzhaem faylov
                for file in files:
                    if file.endswith(".py"):
                        continue
                    local_file = os.path.join(root, file)
                    print(f"  -> {file}")
                    try:
                        with open(local_file, "rb") as f:
                            ftp.storbinary(f"STOR {file}", f)
                    except Exception as e:
                        print(f"  [ERROR] {file}: {e}")
                
                # Vozvrashchaemsya nazad
                if rel_path != ".":
                    ftp.cwd("..")
                    for _ in range(len(rel_path.split(os.sep)) - 1):
                        try:
                            ftp.cwd("..")
                        except:
                            pass
            
            # Vozvrashchaemsya v kornevuyu
            ftp.cwd("..")
    
    ftp.quit()
    
    print("\n" + "=" * 50)
    print("[OK] ZAGRUZKA ZAVERSHENA!")
    print("=" * 50)
    print("\nSayt dostupan: https://kerosmods.ru")
    print()
    input("Nazhmite Enter dlya vykhoda...")

if __name__ == "__main__":
    main()
