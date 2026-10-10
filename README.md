# Sistem Absensi Wajah dengan OpenCV 📷

Aplikasi absensi (daftar hadir) menggunakan **deteksi &amp; pengenalan wajah**
dengan OpenCV. Tersedia dua antarmuka:

- 🌐 **Versi Web** (disarankan) — kamera diakses lewat browser, proses
  pengenalan di server (Flask + WebSocket). Bisa dibuka dari HP/laptop lain.
- 🖥️ **Versi CLI** — jendela OpenCV asli di desktop.

Pengenalan wajah memakai algoritma **LBPH** (_Local Binary Patterns
Histograms_) dari `opencv-contrib-python`.

---

## ✨ Fitur

- 📸 Pendaftaran wajah baru lewat kamera (otomatis mengambil 50 sampel)
- 🧠 Pelatihan model pengenalan wajah
- ✅ Absensi otomatis saat wajah dikenali
- 🔊 Pengumuman suara nama saat absensi baru berhasil dicatat (versi web)
- 🚫 Tidak mencatat nama yang sama dua kali dalam sehari
- 📄 Catatan kehadiran tersimpan ke **CSV** per hari
- 📱 Antarmuka web yang _responsive_ (bisa dipakai dari HP)
- 🔌 File Haar Cascade sudah **dibundel** (tidak perlu unduh saat runtime)

---

## 📁 Struktur Proyek

```
.
├── run_web.py           # Jalankan server web (paling mudah!)
├── webapp/
│   ├── app.py           # Aplikasi Flask + WebSocket
│   ├── templates/index.html
│   └── static/app.js
├── face_engine.py       # Mesin OpenCV (deteksi, LBPH, kehadiran)
├── main.py              # Menu CLI interaktif
├── capture_faces.py     # CLI: daftarkan wajah
├── train_model.py       # CLI: latih model
├── absen.py             # CLI: absensi via jendela OpenCV
├── config.py            # Pengaturan
├── cascades/            # File Haar Cascade (sudah disertakan)
├── dataset/             # Foto sampel wajah (per nama)
├── trainer/             # Model hasil latihan (.yml + .json)
├── attendance/          # Catatan kehadiran CSV per hari
└── .vscode/launch.json  # Konfigurasi Run/Debug VS Code
```

---

## 🌐 Cara Menjalankan Versi Web

### 1. Pasang dependensi

Buka terminal di VS Code (`` Ctrl + ` ``):

```bash
pip install -r requirements.txt
```

> Disarankan memakai _virtual environment_:
> ```bash
> python -m venv .venv
> # Windows
> .venv\Scripts\activate
> # Linux/Mac
> source .venv/bin/activate
> pip install -r requirements.txt
> ```

### 2. Jalankan server

```bash
python run_web.py
```

Server berjalan di **http://localhost:5000** — buka alamat itu di browser.

### 3. Di VS Code (opsional)

Tekan `F5` lalu pilih konfigurasi **"Web: Jalankan Server"**.

### 4. Mengakses dari perangkat lain (HP)

Server bind ke `0.0.0.0:5000`, jadi perangkat lain di jaringan Wi-Fi yang
sama bisa membuka `http://<IP-komputer>:5000`.

> Browser mewajibkan **kamera** hanya untuk `localhost` atau `https`.
> Untuk membuka dari HP via IP LAN, gunakan _tunnel_ HTTPS (mis. ngrok)
> atau jalankan di belakang HTTPS.

### 5. Alur pemakaian di web

1. **Daftarkan Wajah** — isi nama, klik "Mulai Daftar", tunggu 50 sampel.
2. **Latih Model** — klik "Latih Model Sekarang".
3. **Absensi** — klik "Mulai Absensi"; wajah yang dikenali langsung tercatat.
   Saat absensi baru berhasil dicatat, browser mengucapkan nama dan "terabsen".
4. **Kehadiran** — lihat/unduh catatan per tanggal.

---

## 🖥️ Cara Menjalankan Versi CLI

```bash
python main.py
```

Atau jalankan per langkah:

```bash
python capture_faces.py Budi   # 1. daftarkan wajah
python train_model.py          # 2. latih model
python absen.py                # 3. mulai absensi (tekan q untuk keluar)
```

> CLI membutuhkan tampilan GUI (jendela OpenCV). Di Windows/macOS/Linux
> desktop berjalan normal. Untuk WSL/headless, gunakan **versi web**.

---

## 📄 Contoh File Kehadiran

Tersimpan di `attendance/kehadiran_2026-08-23.csv`:

```csv
Nama,Tanggal,Waktu
Budi,2026-08-23,08:05:12
Sari,2026-08-23,08:07:45
```

---

## 🔌 API Web (untuk integrasi)

| Method | Path | Keterangan |
|---|---|---|
| `GET`  | `/` | Halaman web |
| `GET`  | `/api/people` | Daftar nama + jumlah sampel + status model |
| `POST` | `/api/train` | Melatih model dari dataset |
| `GET`  | `/api/attendance/today` | Catatan kehadiran hari ini |
| `GET`  | `/api/attendance/dates` | Daftar tanggal yang ada catatannya |
| `GET`  | `/api/attendance/<tgl>` | Catatan pada tanggal tertentu (`YYYY-MM-DD`) |
| `WS`   | `/ws/attend` | Stream frame absensi (frame masuk → frame beranotasi keluar) |
| `WS`   | `/ws/enroll` | Stream pendaftaran wajah (kirim `{"name":"..."}` lalu frame) |

---

## ⚙️ Pengaturan (`config.py`)

| Pengaturan | Default | Keterangan |
|---|---|---|
| `CAMERA_INDEX` | `0` | Kamera untuk versi CLI |
| `CONFIDENCE_THRESHOLD` | `50` | Ambang LBPH (lebih kecil = lebih ketat, mengurangi salah kenal) |
| `RECOGNITION_CONFIRMATIONS` | `3` | Jumlah frame konsisten sebelum absensi dicatat |
| `SAMPLES_PER_PERSON` | `50` | Jumlah sampel saat mendaftar |
| `FACE_SIZE` | `(200,200)` | Ukuran wajah untuk pengenalan |

> Jika wajah benar sering "Tidak Dikenal", naikkan threshold sedikit demi sedikit.
> Jika orang lain salah dikenali, turunkan threshold dan latih ulang model.

---

## ❓ Pemecahan Masalah

**"Tidak dapat mengakses kamera" di browser**
- Berikan izin kamera saat browser memintanya.
- Pastikan situs dibuka via `localhost` atau HTTPS (bukan `http://IP`).
- Kamera tidak boleh sedang dipakai aplikasi lain.

**`cv2.face` tidak ada / error import**
```bash
pip uninstall -y opencv-python opencv-contrib-python opencv-contrib-python-headless
pip install -r requirements.txt
```
Jangan mencampur `opencv-python` dengan varian `contrib`.

**Wajah terdaftar tapi tidak dikenali**
- Ambil lebih banyak sampel dengan pencahayaan/sudut bervariasi.
- Latih ulang model. Sesuaikan `CONFIDENCE_THRESHOLD`.

**Nama absensi sering tertukar**
- Pastikan data sampel setiap orang hanya berisi wajah orang tersebut.
- Daftarkan ulang orang yang tertukar, lalu latih ulang model.
- Turunkan `CONFIDENCE_THRESHOLD` jika nama yang salah masih muncul.

**Versi NumPy error saat import cv2**
- `requirements.txt` sudah membatasi `numpy<2` agar kompatibel dengan
  OpenCV 4.x. Jalankan `pip install -r requirements.txt`.

---

## 🛠️ Teknologi

- Python 3.9+
- OpenCV (`opencv-contrib-python-headless`)
- NumPy
- Flask + flask-sock (WebSocket)
- Algoritma LBPH Face Recognizer

---

## Lisensi

Bebas dipakai untuk keperluan belajar.
