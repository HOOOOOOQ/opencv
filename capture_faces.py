"""
Pendaftaran wajah baru.

Menangkap beberapa sampel foto wajah dari kamera dan menyimpannya
ke folder dataset/<nama>/ untuk dilatih kemudian.

Penggunaan:
    python capture_faces.py <nama>
    python capture_faces.py Budi
"""
import cv2
import os
import sys
import config


def ambil_wajah(nama, jumlah_sampel=config.SAMPLES_PER_PERSON):
    nama = nama.strip()
    if not nama:
        print("Nama tidak boleh kosong.")
        return

    # Muat detektor wajah Haar Cascade
    try:
        cascade_path = config.get_cascade_path()
    except Exception as e:
        print(f"Gagal memuat Haar Cascade: {e}")
        return
    face_cascade = cv2.CascadeClassifier(cascade_path)
    if face_cascade.empty():
        print("Gagal memuat Haar Cascade. Pastikan opencv-contrib-python terinstal.")
        return

    # Siapkan folder penyimpanan
    folder_orang = os.path.join(config.DATASET_DIR, nama)
    os.makedirs(folder_orang, exist_ok=True)

    # Buka kamera
    cam = cv2.VideoCapture(config.CAMERA_INDEX)
    if not cam.isOpened():
        print(f"Tidak dapat membuka kamera (index {config.CAMERA_INDEX}).")
        print("Coba ubah nilai CAMERA_INDEX di file config.py menjadi 1 atau 2.")
        return
    cam.set(3, 640)
    cam.set(4, 480)

    count = 0
    print(f"\nMendaftarkan wajah: {nama}")
    print(f"Akan mengambil {jumlah_sampel} sampel.")
    print("Hadapkan wajah ke kamera. Tekan 'q' untuk berhenti lebih awal.\n")

    try:
        while True:
            ret, frame = cam.read()
            if not ret:
                print("Gagal membaca frame dari kamera.")
                break

            frame = cv2.flip(frame, 1)  # efek cermin agar lebih natural
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

            faces = face_cascade.detectMultiScale(
                gray,
                scaleFactor=1.2,
                minNeighbors=5,
                minSize=(100, 100),
            )

            for (x, y, w, h) in faces:
                # Gambar kotak di sekitar wajah
                cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 0), 2)

                # Potong, ubah ukuran, dan simpan wajah
                wajah = gray[y:y + h, x:x + w]
                wajah = cv2.resize(wajah, config.FACE_SIZE)
                count += 1
                path_simpan = os.path.join(folder_orang, f"{nama}_{count}.jpg")
                cv2.imwrite(path_simpan, wajah)

                # Tampilkan progres pada jendela
                cv2.putText(
                    frame,
                    f"Sampel: {count}/{jumlah_sampel}",
                    (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    (0, 255, 0),
                    2,
                )

            cv2.imshow('Pendaftaran Wajah', frame)

            # Tekan q untuk berhenti
            if cv2.waitKey(100) & 0xFF == ord('q'):
                break
            if count >= jumlah_sampel:
                break
    finally:
        cam.release()
        cv2.destroyAllWindows()

    print(f"\nSelesai! {count} sampel wajah untuk '{nama}' tersimpan di:")
    print(f"  {folder_orang}")
    print("\nLangkah berikutnya:  python train_model.py")


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Penggunaan: python capture_faces.py <nama>")
        print("Contoh:    python capture_faces.py Budi")
        sys.exit(1)
    ambil_wajah(sys.argv[1])
