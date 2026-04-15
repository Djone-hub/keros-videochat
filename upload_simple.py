# -*- coding: utf-8 -*-
"""
Skript zagruzki faylov na hosting cherez FTP
"""

import os
import time
from ftplib import FTP

FTP_HOST = "65.108.228.42"
FTP_USER = "keros492"
FTP_PASSWORD = "198029aaa@@29S"
FTP_PORT = 21

LOCAL_DIR = r"h:\KEROS_MODS_2025\SAITE_READY_FOR_UPLOAD"
REMOTE_DIR = "/domains/kerosmods.ru/public_html"

def main():
    print("=" * 50)
    print("Zagruzka faylov na kerosmods.ru")
    print("=" * 50)
    
    ftp = None
    try:
        print("\nPodkluchenie (mojet zanyat vremya)...")
        ftp = FTP()
        ftp.connect(FTP_HOST, FTP_PORT, timeout=180)
        print("Login...")
        ftp.login(FTP_USER, FTP_PASSWORD)
        print("Set passive mode...")
        ftp.set_pasv(False)
        print("[OK] Podklucheno")
        
        print(f"\nPerekhod v {REMOTE_DIR}...")
        ftp.cwd(REMOTE_DIR)
        print("[OK]")
        
        # Zagruzhaem faylov
        files = ["script.js", "script_head.js"]
        print("\nZagruzka faylov:")
        for f in files:
            local = os.path.join(LOCAL_DIR, f)
            if os.path.exists(local):
                size = os.path.getsize(local) // 1024
                print(f"  -> {f} ({size} KB)")
                try:
                    with open(local, "rb") as file:
                        ftp.storbinary(f"STOR {f}", file, blocksize=8192)
                    print(f"     [OK] Zagruzhen")
                except Exception as e:
                    print(f"     [ERROR] {e}")
            else:
                print(f"     [WARN] {f} ne nayden")
        
        print("\n" + "=" * 50)
        print("[OK] ZAGRUZKA ZAVERSHENA!")
        print("=" * 50)
        print("\nObnovite sayt: https://kerosmods.ru")
        
    except Exception as e:
        print(f"\n[ERROR] {type(e).__name__}: {e}")
    finally:
        if ftp:
            try:
                print("\nOtklyuchenie...")
                ftp.quit()
                print("[OK] Otklyucheno")
            except:
                pass

if __name__ == "__main__":
    main()
