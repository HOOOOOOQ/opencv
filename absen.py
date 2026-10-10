"""
Aplikasi absensi wajah.

Membuka kamera, mendeteksi & mengenali wajah berdasarkan model yang
sudah dilatih, lalu mencatat kehadiran ke file CSV harian di folder
attendance/ (satu baris per orang per hari).

Penggunaan:
    python absen.py
"""
import cv2
import os
import json
from datetime import datetime
import config


def muat_model():
    """Memuat model LBPH & pemetaan id -> nama. Return (None, None) bila belum ada."""
    if not (os.path.exists(config.MODEL_FILE) and os.path.exists(config.LABELS_FILE)):
        return None, None

    recognizer = cv2.face.LBPHFaceRecognizer_create()
    recognizer.read(config.MODEL_FILE)

    with open(config.LABELS_FILE, 'r', encoding='utf-8') as f:
        id_ke_nama = json.load(f)

    return recognizer, id_ke_nama


def catat_kehadiran(nama):
    """
    Menulis kehadiran ke CSV harian.
    Return True jika baru saja tercatat, False jika orang tersebut sudah absen hari ini.
    """
    os.makedirs(config.ATTENDANCE_DIR, exist_ok=True)

    tanggal = datetime.now().strftime('%Y-%m-%d')
    path_csv = os.path.join(config.ATTENDANCE_DIR, f'kehadiran_{tanggal}.csv')

    # Kumpulkan nama yang sudah absen hari ini
    sudah_absen = set()
    if os.path.exists(path_csv):
        with open(path_csv, 'r', newline='', encoding='utf-8') as f:
            next(f, None)  # lewati baris header
            for baris in f:
                bagian = baris.strip().split(',')
                if bagian:
                    sudah_absen.add(bagian[0])

    if nama in sudah_absen:
        return False

    sekarang = datetime.now()
    file_baru = not os.path.exists(path_csv)
    with open(path_csv, 'a', newline='', encoding='utf-8') as f:
        if file_baru:
            f.write('Nama,Tanggal,Waktu\n')
        f.write(f"{nama},{sekarang:%Y-%m-%d},{sekarang:%H:%M:%S}\n")

    return True


def mulai_absen():
    recognizer, id_ke_nama = muat_model()
    if recognizer is None:
        print("Model belum ditemukan.")
        print("Jalankan secara berurutan:")
        print("  1) python capture_faces.py <nama>")
        print("  2) python train_model.py")
        print("  3) python absen.py")
        return

    try:
        cascade_path = config.get_cascade_path()
    except Exception as e:
        print(f"Gagal memuat Haar Cascade: {e}")
        return
    detektor = cv2.CascadeClassifier(cascade_path)
    if detektor.empty():
        print("Gagal memuat Haar Cascade.")
        return

    cam = cv2.VideoCapture(config.CAMERA_INDEX)
    if not cam.isOpened():
        print(f"Tidak dapat membuka kamera (index {config.CAMERA_INDEX}).")
        print("Coba ubah CAMERA_INDEX di config.py menjadi 1 atau 2.")
        return
    cam.set(3, 640)
    cam.set(4, 480)

    print("\nSistem absensi aktif. Tekan 'q' untuk keluar.\n")

    # Mencegah pencatatan berulang dalam beberapa detik untuk orang yang sama
    cooldown = {}
    recognition_streaks = {}
    COOLDOWN_DETIK = 5

    try:
        while True:
            ret, frame = cam.read()
            if not ret:
                print("Gagal membaca frame dari kamera.")
                break

            frame = cv2.flip(frame, 1)
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

            wajah = detektor.detectMultiScale(
                gray,
                scaleFactor=1.2,
                minNeighbors=5,
                minSize=(100, 100),
            )

            predictions = []
            frame_names = set()
            for (x, y, w, h) in wajah:
                roi = gray[y:y + h, x:x + w]
                roi = cv2.resize(roi, config.FACE_SIZE)

                label_id, confidence = recognizer.predict(roi)
                nama = id_ke_nama.get(str(label_id), "Tidak Dikenal")
                recognized = confidence < config.CONFIDENCE_THRESHOLD
                predictions.append((x, y, w, h, nama, confidence, recognized))
                if recognized:
                    frame_names.add(nama)

            for nama in set(recognition_streaks) | frame_names:
                if nama in frame_names:
                    recognition_streaks[nama] = recognition_streaks.get(nama, 0) + 1
                else:
                    recognition_streaks[nama] = 0

            for x, y, w, h, nama, confidence, recognized in predictions:
                if recognized and recognition_streaks[nama] >= config.RECOGNITION_CONFIRMATIONS:
                    warna = (0, 255, 0)  # hijau = dikenali
                    teks = f"{nama} ({confidence:.1f})"

                    sekarang = datetime.now()
                    terakhir = cooldown.get(nama)
                    if terakhir is None or (sekarang - terakhir).total_seconds() > COOLDOWN_DETIK:
                        if catat_kehadiran(nama):
                            print(f"[OK] {nama} absen pada {sekarang:%H:%M:%S}")
                        cooldown[nama] = sekarang
                elif recognized:
                    warna = (0, 200, 255)  # kuning = menunggu konfirmasi
                    teks = f"Memastikan: {nama}"
                else:
                    warna = (0, 0, 255)  # merah = tidak dikenal
                    teks = f"Tidak Dikenal ({confidence:.1f})"

                cv2.rectangle(frame, (x, y), (x + w, y + h), warna, 2)
                cv2.putText(
                    frame, teks, (x, y - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, warna, 2,
                )

            cv2.imshow('Sistem Absensi Wajah', frame)

            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
    finally:
        cam.release()
        cv2.destroyAllWindows()

    print("Aplikasi absensi ditutup.")


if __name__ == '__main__':
    mulai_absen()
