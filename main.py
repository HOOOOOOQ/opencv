"""
Menu utama interaktif untuk sistem absensi wajah.

Jalankan:
    python main.py
"""
import os
import sys
import subprocess


def bersihkan_layar():
    os.system('cls' if os.name == 'nt' else 'clear')


def jalankan(script, *args):
    """Menjalankan skrip Python lain dengan interpreter yang sama."""
    subprocess.run([sys.executable, script, *args])


def tampilkan_menu():
    while True:
        bersihkan_layar()
        print("=" * 48)
        print("       SISTEM ABSENSI WAJAH - OPENCV")
        print("=" * 48)
        print("  1. Daftarkan wajah baru")
        print("  2. Latih model pengenalan wajah")
        print("  3. Mulai absensi (buka kamera)")
        print("  4. Keluar")
        print("-" * 48)
        pilihan = input("Pilih menu [1-4]: ").strip()

        if pilihan == '1':
            nama = input("Masukkan nama: ").strip()
            if nama:
                jalankan('capture_faces.py', nama)
            else:
                print("Nama tidak boleh kosong.")
            input("\nTekan Enter untuk kembali ke menu...")

        elif pilihan == '2':
            jalankan('train_model.py')
            input("\nTekan Enter untuk kembali ke menu...")

        elif pilihan == '3':
            jalankan('absen.py')

        elif pilihan == '4':
            print("Sampai jumpa!")
            break

        else:
            print("Pilihan tidak valid.")
            input("\nTekan Enter untuk kembali ke menu...")


if __name__ == '__main__':
    tampilkan_menu()
