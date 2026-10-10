"""
Mesin pengenalan wajah yang dipakai bersama oleh CLI dan web.

Membungkus:
  - Detektor wajah Haar Cascade (file XML dibundel di folder cascades/)
  - Pengenal LBPH (model disimpan di trainer/trainer.yml)
  - Penyimpanan sampel wajah di dataset/<nama>/
  - Pelatihan model
  - Pencatatan kehadiran ke CSV harian
"""
import cv2
import os
import csv
import json
import threading
from datetime import datetime

import numpy as np

import config


class FaceEngine:
    def __init__(self):
        self._lock = threading.RLock()
        cascade_path = config.get_cascade_path()
        self.face_cascade = cv2.CascadeClassifier(cascade_path)
        if self.face_cascade.empty():
            raise RuntimeError(f"Gagal memuat Haar Cascade dari {cascade_path}")
        self.recognizer = None
        self.id_to_name = {}
        self.reload()

    # ------------------------------------------------------------------ model
    def reload(self):
        """Muat ulang model LBPH dari disk (setelah dilatih)."""
        with self._lock:
            if os.path.exists(config.MODEL_FILE) and os.path.exists(config.LABELS_FILE):
                rec = cv2.face.LBPHFaceRecognizer_create()
                rec.read(config.MODEL_FILE)
                with open(config.LABELS_FILE, 'r', encoding='utf-8') as f:
                    self.id_to_name = json.load(f)
                self.recognizer = rec
            else:
                self.recognizer = None
                self.id_to_name = {}

    def is_trained(self):
        return self.recognizer is not None and bool(self.id_to_name)

    # --------------------------------------------------------------- deteksi
    def detect_faces(self, gray):
        """Return list [(x,y,w,h), ...] dari citra abu-abu."""
        with self._lock:
            return list(self.face_cascade.detectMultiScale(
                gray, scaleFactor=1.2, minNeighbors=5, minSize=(80, 80)
            ))

    def detect_faces_fast(self, gray, scale=0.5):
        """
        Deteksi wajah pada citra yang diperkecil (lebih cepat), lalu
        skalakan koordinat kembali ke ukuran asli.
        """
        h, w = gray.shape[:2]
        sw, sh = max(1, int(w * scale)), max(1, int(h * scale))
        with self._lock:
            small = cv2.resize(gray, (sw, sh))
            found = self.face_cascade.detectMultiScale(
                small, scaleFactor=1.2, minNeighbors=5, minSize=(40, 40)
            )
        inv = 1.0 / scale
        return [
            (int(x * inv), int(y * inv), int(ww * inv), int(hh * inv))
            for (x, y, ww, hh) in found
        ]

    def predict(self, face_roi):
        """Return (nama, confidence). confidence=inf bila model belum ada."""
        with self._lock:
            if self.recognizer is None:
                return None, float('inf')
            label_id, conf = self.recognizer.predict(face_roi)
            return self.id_to_name.get(str(label_id), "Tidak Dikenal"), conf

    # ------------------------------------------------------------- dataset
    @staticmethod
    def list_people():
        if not os.path.exists(config.DATASET_DIR):
            return []
        return sorted(
            d for d in os.listdir(config.DATASET_DIR)
            if os.path.isdir(os.path.join(config.DATASET_DIR, d))
        )

    @staticmethod
    def count_samples(name):
        folder = os.path.join(config.DATASET_DIR, name.strip())
        if not os.path.exists(folder):
            return 0
        return sum(
            1 for f in os.listdir(folder)
            if f.lower().endswith(('.jpg', '.jpeg', '.png'))
        )

    @staticmethod
    def reset_person(name):
        """Hapus sampel lama agar sesi pendaftaran dimulai dari 0."""
        folder = os.path.join(config.DATASET_DIR, name.strip())
        if os.path.exists(folder):
            for f in os.listdir(folder):
                if f.lower().endswith(('.jpg', '.jpeg', '.png')):
                    os.remove(os.path.join(folder, f))

    @staticmethod
    def add_sample(name, face_img):
        """Simpan satu citra wajah (sudah terpotong, grayscale). Return jumlah total."""
        name = name.strip()
        folder = os.path.join(config.DATASET_DIR, name)
        os.makedirs(folder, exist_ok=True)
        n = FaceEngine.count_samples(name) + 1
        roi = cv2.resize(face_img, config.FACE_SIZE)
        path = os.path.join(folder, f"{name}_{n}.jpg")
        cv2.imwrite(path, roi)
        return n

    # ------------------------------------------------------------- latih
    def train(self):
        """Latih model dari seluruh isi dataset/. Return (jumlah_sampel, jumlah_orang)."""
        with self._lock:
            faces = []
            labels = []
            name_to_id = {}

            people = self.list_people()
            for pid, name in enumerate(people):
                name_to_id[name] = pid
                folder = os.path.join(config.DATASET_DIR, name)
                files = sorted(
                    f for f in os.listdir(folder)
                    if f.lower().endswith(('.jpg', '.jpeg', '.png'))
                )
                for fn in files:
                    img = cv2.imread(os.path.join(folder, fn), cv2.IMREAD_GRAYSCALE)
                    if img is None:
                        continue
                    faces.append(cv2.resize(img, config.FACE_SIZE))
                    labels.append(pid)

            if not faces:
                return 0, 0

            rec = cv2.face.LBPHFaceRecognizer_create(
                radius=1, neighbors=8, grid_x=8, grid_y=8
            )
            rec.train(faces, np.array(labels))

            os.makedirs(config.TRAINER_DIR, exist_ok=True)
            rec.write(config.MODEL_FILE)

            id_to_name = {str(v): k for k, v in name_to_id.items()}
            with open(config.LABELS_FILE, 'w', encoding='utf-8') as f:
                json.dump(id_to_name, f, indent=2, ensure_ascii=False)

            self.recognizer = rec
            self.id_to_name = id_to_name
            return len(faces), len(people)

    # ---------------------------------------------------------- kehadiran
    @staticmethod
    def attendance_file(date_str=None):
        os.makedirs(config.ATTENDANCE_DIR, exist_ok=True)
        if date_str is None:
            date_str = datetime.now().strftime('%Y-%m-%d')
        return os.path.join(config.ATTENDANCE_DIR, f'kehadiran_{date_str}.csv')

    @staticmethod
    def record_attendance(name):
        """
        Catat kehadiran ke CSV harian.
        Return True bila baru tercatat, False bila sudah absen hari ini.
        """
        name = name.strip()
        path = FaceEngine.attendance_file()
        already = set()
        if os.path.exists(path):
            with open(path, 'r', newline='', encoding='utf-8') as f:
                reader = csv.reader(f)
                next(reader, None)  # header
                for row in reader:
                    if row:
                        already.add(row[0].strip())

        if name in already:
            return False

        now = datetime.now()
        new_file = not os.path.exists(path)
        with open(path, 'a', newline='', encoding='utf-8') as f:
            if new_file:
                f.write('Nama,Tanggal,Waktu\n')
            f.write(f"{name},{now:%Y-%m-%d},{now:%H:%M:%S}\n")
        return True

    @staticmethod
    def list_attendance_dates():
        if not os.path.exists(config.ATTENDANCE_DIR):
            return []
        dates = []
        for f in os.listdir(config.ATTENDANCE_DIR):
            if f.startswith('kehadiran_') and f.endswith('.csv'):
                dates.append(f[len('kehadiran_'):-len('.csv')])
        return sorted(dates, reverse=True)

    @staticmethod
    def read_attendance(date_str):
        path = FaceEngine.attendance_file(date_str)
        rows = []
        if not os.path.exists(path):
            return rows
        with open(path, 'r', newline='', encoding='utf-8') as f:
            reader = csv.reader(f)
            next(reader, None)  # header
            for row in reader:
                if len(row) >= 3:
                    rows.append({'name': row[0], 'date': row[1], 'time': row[2]})
        return rows


# Satu instance dipakai bersama aplikasi
engine = FaceEngine()
