# -*- coding: utf-8 -*-
"""
Skript zagruzki faylov na hosting cherez FTP
"""

import os
import time
import socket
from ftplib import FTP, error_temp, all_errors

FTP_HOST = "65.108.228.42"
FTP_USER = "keros492"
FTP_PASSWORD = "198029aaa@@29S"
FTP_PORT = 21

LOCAL_DIR = r"h:\KEROS_MODS_2025\SAITE_READY_FOR_UPLOAD"
REMOTE_DIR = "/domains/kerosmods.ru/public_html"

def upload_file_retry(ftp, local_path, remote_path, retries=5):
    for i in range(retries):
        try:
            print(f"  -> {remote_path} ({os.path.getsize(local_path) // 1024} KB)")
            with open(local_path, "rb") as f:
                ftp.storbinary(f"STOR {remote_path}", f, blocksize=8192, timeout=120)
            print(f"     [OK]")
            return True
        except Exception as e:
            print(f"     [Retry {i+1}/{retries}] {type(e).__name__}: {e}")
            time.sleep(3)
            # Perepodkluchenie
            try:
                ftp.quit()
            except:
                pass
            ftp.connect(FTP_HOST, FTP_PORT, timeout=60)
            ftp.login(FTP_USER, FTP_PASSWORD)
            ftp.set_pasv(True)
            ftp.cwd(REMOTE_DIR)
    return False

def main():
    print("=" * 50)
    print("Zagruzka faylov na kerosmods.ru")
    print("=" * 50)
    
    ftp = None
    try:
        print("\nPodkluchenie...")
        ftp = FTP()
        ftp.connect(FTP_HOST, FTP_PORT, timeout=60)
        ftp.login(FTP_USER, FTP_PASSWORD)
        ftp.set_pasv(True)
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
                if upload_file_retry(ftp, local, f):
                    print(f"     [OK] {f} zagruzhen")
                else:
                    print(f"     [ERROR] {f} ne zagruzhen")
            else:
                print(f"     [WARN] {f} ne nayden")
        
        print("\n" + "=" * 50)
        print("[OK] ZAGRUZKA ZAVERSHENA!")
        print("=" * 50)
        print("\nObnovite sayt: https://kerosmods.ru")
        
    except Exception as e:
        print(f"\n[ERROR] {e}")
    finally:
        if ftp:
            try:
                ftp.quit()
            except:
                pass

if __name__ == "__main__":
    main()
