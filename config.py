"""
Konfigurasi bersama untuk sistem absensi wajah.
Ubah nilai di sini jika perlu menyesuaikan kamera atau ambang pengenalan.
"""
import os

# --- Lokasi folder & file ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_DIR = os.path.join(BASE_DIR, 'dataset')
TRAINER_DIR = os.path.join(BASE_DIR, 'trainer')
ATTENDANCE_DIR = os.path.join(BASE_DIR, 'attendance')

MODEL_FILE = os.path.join(TRAINER_DIR, 'trainer.yml')
LABELS_FILE = os.path.join(TRAINER_DIR, 'labels.json')

# Index kamera (0 = kamera bawaan). Jika kamera tidak terdeteksi, coba 1 atau 2.
CAMERA_INDEX = 0

# Ukuran wajah yang dipakai untuk pengenalan (lebar, tinggi) dalam piksel.
FACE_SIZE = (200, 200)

# Ambang LBPH; nilai lebih kecil lebih ketat dan mengurangi salah kenal.
CONFIDENCE_THRESHOLD = 50

# Nama harus konsisten terdeteksi beberapa frame sebelum absensi dicatat.
RECOGNITION_CONFIRMATIONS = 3

# Jumlah sampel foto yang diambil saat mendaftarkan satu wajah.
SAMPLES_PER_PERSON = 50

# Nama file detektor wajah Haar Cascade bawaan OpenCV
CASCADE_NAME = 'haarcascade_frontalface_default.xml'

# Sumber cadangan bila file cascade tidak disertakan instalasi OpenCV
# (mis. opencv-contrib-python-headless 5.x yang folder datanya kosong).
CASCADE_URL = (
    'https://raw.githubusercontent.com/opencv/opencv/'
    'master/data/haarcascades/' + CASCADE_NAME
)

# Folder lokal untuk menyimpan cascade yang diunduh otomatis
CASCADE_DIR = os.path.join(BASE_DIR, 'cascades')


def get_cascade_path():
    """
    Mengembalikan path lengkap ke file Haar Cascade.

    Urutan pencarian:
      1. Folder cascades/ di proyek (sudah pernah diunduh).
      2. Bawaan OpenCV lewat cv2.data.haarcascades.
      3. Lokasi sistem umum (/usr/share/opencv*, /usr/local/share/...).
      4. Jika tetap tidak ada, unduh dari repositori resmi OpenCV ke cascades/.
    """
    import urllib.request

    # 1. Salinan lokal di proyek
    lokal = os.path.join(CASCADE_DIR, CASCADE_NAME)
    if os.path.exists(lokal) and os.path.getsize(lokal) > 0:
        return lokal

    # 2. Bawaan OpenCV
    try:
        import cv2
        path_bawaan = os.path.join(cv2.data.haarcascades, CASCADE_NAME)
        if os.path.exists(path_bawaan) and os.path.getsize(path_bawaan) > 0:
            return path_bawaan
    except Exception:
        pass

    # 3. Lokasi sistem umum
    kandidat = [
        '/usr/share/opencv4/haarcascades/' + CASCADE_NAME,
        '/usr/share/opencv/haarcascades/' + CASCADE_NAME,
        '/usr/local/share/opencv4/haarcascades/' + CASCADE_NAME,
        '/usr/local/share/opencv/haarcascades/' + CASCADE_NAME,
    ]
    for path in kandidat:
        if os.path.exists(path) and os.path.getsize(path) > 0:
            return path

    # 4. Unduh dari repositori resmi
    print("File Haar Cascade tidak ditemukan di sistem.")
    print(f"Mengunduh dari {CASCADE_URL} ...")
    os.makedirs(CASCADE_DIR, exist_ok=True)
    try:
        urllib.request.urlretrieve(CASCADE_URL, lokal)
    except Exception as e:
        raise RuntimeError(
            "Gagal mengunduh Haar Cascade. "
            f"Unduh manual '{CASCADE_NAME}' dari repositori OpenCV dan "
            f"letakkan di folder '{CASCADE_DIR}/'. Detail: {e}"
        )
    print(f"Disimpan ke: {lokal}")
    return lokal
