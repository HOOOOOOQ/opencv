"""
Melatih model pengenalan wajah LBPH.

Membaca semua gambar wajah di folder dataset/, lalu melatih
pengenal wajah dan menyimpannya ke trainer/trainer.yml beserta
pemetaan label (nama) di trainer/labels.json.

Penggunaan:
    python train_model.py
"""
import cv2
import numpy as np
import os
import json
import config


def muat_detektor():
    """
    Memuat detektor Haar Cascade. Bila file tidak tersedia, mengembalikan
    CascadeClassifier kosong (empty) dan baca_dataset() akan memakai seluruh
    gambar (yang biasanya sudah terpotong saat pendaftaran).
    """
    try:
        return cv2.CascadeClassifier(config.get_cascade_path())
    except Exception as e:
        print(f"Peringatan: Haar Cascade tidak tersedia ({e}).")
        print("Akan memakai seluruh gambar dataset sebagai wajah (pastikan gambar sudah terpotong).")
        return cv2.CascadeClassifier()


def baca_dataset():
    """Membaca wajah & label dari folder dataset/."""
    detektor = muat_detektor()

    wajah_list = []
    label_list = []
    nama_ke_id = {}
    id_saat_ini = 0

    if not os.path.exists(config.DATASET_DIR):
        return wajah_list, label_list, nama_ke_id

    # Urutkan agar pemberian id konsisten
    daftar_orang = sorted(
        d for d in os.listdir(config.DATASET_DIR)
        if os.path.isdir(os.path.join(config.DATASET_DIR, d))
    )

    for nama in daftar_orang:
        path_orang = os.path.join(config.DATASET_DIR, nama)
        nama_ke_id[nama] = id_saat_ini
        jumlah = 0

        file_gambar = sorted(
            f for f in os.listdir(path_orang)
            if f.lower().endswith(('.jpg', '.jpeg', '.png'))
        )

        for nama_file in file_gambar:
            path_file = os.path.join(path_orang, nama_file)
            img = cv2.imread(path_file, cv2.IMREAD_GRAYSCALE)
            if img is None:
                continue

            # Coba deteksi wajah di dalam gambar (hanya bila detektor valid)
            if not detektor.empty():
                terdeteksi = detektor.detectMultiScale(img, scaleFactor=1.2, minNeighbors=5)
            else:
                terdeteksi = []

            if len(terdeteksi) > 0:
                for (x, y, w, h) in terdeteksi:
                    roi = cv2.resize(img[y:y + h, x:x + w], config.FACE_SIZE)
                    wajah_list.append(roi)
                    label_list.append(id_saat_ini)
                    jumlah += 1
            else:
                # Tidak terdeteksi -> pakai seluruh gambar (biasanya sudah terpotong)
                roi = cv2.resize(img, config.FACE_SIZE)
                wajah_list.append(roi)
                label_list.append(id_saat_ini)
                jumlah += 1

        print(f"  - {nama}: {jumlah} sampel")
        id_saat_ini += 1

    return wajah_list, label_list, nama_ke_id


def latih():
    print("Membaca data wajah dari folder dataset/ ...")
    wajah_list, label_list, nama_ke_id = baca_dataset()

    if not wajah_list:
        print("\nBelum ada data wajah.")
        print("Daftarkan wajah dulu dengan:  python capture_faces.py <nama>")
        return False

    print(f"\nTotal {len(wajah_list)} sampel dari {len(nama_ke_id)} orang.")
    print("Melatih model LBPH (Local Binary Patterns Histograms)...")

    recognizer = cv2.face.LBPHFaceRecognizer_create(
        radius=1, neighbors=8, grid_x=8, grid_y=8
    )
    recognizer.train(wajah_list, np.array(label_list))

    # Simpan model & label
    os.makedirs(config.TRAINER_DIR, exist_ok=True)
    recognizer.write(config.MODEL_FILE)

    id_ke_nama = {str(v): k for k, v in nama_ke_id.items()}
    with open(config.LABELS_FILE, 'w', encoding='utf-8') as f:
        json.dump(id_ke_nama, f, indent=2, ensure_ascii=False)

    print("\n[OK] Model berhasil dilatih!")
    print(f"  Model : {config.MODEL_FILE}")
    print(f"  Label : {config.LABELS_FILE}")
    print("\nLangkah berikutnya:  python absen.py")
    return True


if __name__ == '__main__':
    latih()
