# 📷 ABSENSI KAMERA — BY KELOMPOK 1 SMK AL MADANI GARUT

Aplikasi **absensi otomatis dengan pengenalan wajah** yang berjalan **100% di
browser** (tanpa server) — siap di-hosting publik di **Vercel** dengan subdomain
**https://kel2.pallrzki.my.id**.

> Versi 2.0 — UI modern (glassmorphism, dark/light mode, splash loading,
> animasi, responsive HP), pengenalan wajah memakai **face-api.js**
> (TensorFlow.js) yang dijalankan langsung di perangkat pengguna.

---

## ✨ Fitur

- 🚀 **Splash screen** dengan progress loading model
- 🎨 UI modern: glassmorphism, gradient, dark/light mode, animasi halus, responsive
- 📸 **Daftar Wajah** — otomatis mengambil 15 sampel wajah + foto thumbnail
- ✅ **Absensi otomatis** — wajah dikenali → langsung tercatat (sekali per hari)
- 🔊 Pengumuman suara (“*Nama*, terabsen”) + bunyi notifikasi
- 🔁 Ganti kamera depan/belakang (HP)
- 📊 **Dashboard** statistik: terdaftar, hadir, belum hadir
- 📄 **Rekap kehadiran** per tanggal, pencarian, status *Hadir/Terlambat*, unduh **CSV**
- 💾 Data tersimpan di `localStorage` perangkat (privasi terjaga, tidak dikirim ke server)
- 📦 Library & model dibundel lokal (`public/vendor/`) — tidak bergantung CDN

---

## 📁 Struktur Proyek

```
.
├── public/                 # ← Web app (yang di-deploy ke Vercel)
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   ├── manifest.webmanifest
│   ├── assets/favicon.svg
│   └── vendor/
│       ├── face-api.js     # @vladmandic/face-api
│       └── models/         # tiny_face_detector, landmark_68_tiny, face_recognition
├── vercel.json             # Konfigurasi Vercel (static, headers, cache)
├── .vercelignore
├── package.json            # npm run dev → preview lokal
│
└── (versi lama Python/OpenCV — opsional, untuk desktop)
    ├── face_engine.py, main.py, capture_faces.py, train_model.py, absen.py
    ├── config.py, requirements.txt
```

---

## 🖥️ Menjalankan Lokal

Cukup sajikan folder `public/` dengan web server statis apa pun:

```bash
# Opsi 1 (Node)
npm run dev            # http://localhost:3000

# Opsi 2 (Python)
python -m http.server 3000 --directory public
```

> Kamera hanya bisa diakses lewat **`localhost`** atau **HTTPS**.

---

## 🌐 Deploy ke Vercel + Subdomain `kel2.pallrzki.my.id`

### 1. Push ke GitHub
Pastikan repo ini sudah ada di GitHub (branch utama).

### 2. Import ke Vercel
1. Buka <https://vercel.com/new> → **Import** repo ini.
2. **Framework Preset:** `Other`.
3. **Build Command:** kosongkan. **Output Directory:** `public`
   (sudah diatur otomatis lewat `vercel.json`).
4. Klik **Deploy** → dapat URL `*.vercel.app`.

### 3. Tambahkan subdomain
1. Di project Vercel → **Settings → Domains** → tambahkan `kel2.pallrzki.my.id`.
2. Vercel akan meminta DNS record. Di pengelola DNS domain **pallrzki.my.id**
   (mis. Cloudflare / registrar), tambahkan:

   | Type  | Name  | Value                  | TTL  |
   |-------|-------|------------------------|------|
   | CNAME | `kel2` | `cname.vercel-dns.com` | Auto |

   > Jika memakai Cloudflare, set proxy ke **DNS only** (awan abu-abu) saat
   > verifikasi pertama agar sertifikat SSL Vercel terbit.
3. Tunggu propagasi DNS (beberapa menit – 1 jam). Vercel otomatis menerbitkan
   **HTTPS** — ini penting karena kamera butuh HTTPS.

### 4. Selesai 🎉
Buka **https://kel2.pallrzki.my.id** dari HP/laptop mana saja.

---

## 📱 Alur Pemakaian

1. **Daftar Wajah** — isi nama & kelas → *Mulai Daftar* → hadapkan wajah,
   gerakkan sedikit kiri/kanan sampai 15/15 sampel.
2. **Absensi** — *Mulai Absensi* → wajah dikenali (kotak hijau) → tercatat +
   suara “*Nama*, terabsen”.
3. **Kehadiran** — pilih tanggal, cari nama, **Unduh CSV**.

---

## ⚙️ Pengaturan (`public/app.js` → `CONFIG`)

| Pengaturan | Default | Keterangan |
|---|---|---|
| `SAMPLES_PER_PERSON` | `15` | Jumlah sampel saat mendaftar |
| `MATCH_THRESHOLD` | `0.5` | Jarak maksimal agar dianggap cocok (lebih kecil = lebih ketat) |
| `CONFIRMATIONS` | `3` | Frame konsisten sebelum dicatat |
| `LATE_AFTER` | `07:30` | Lewat jam ini berstatus **Terlambat** |
| `DETECT_INPUT_SIZE` | `320` | Ukuran input detektor (lebih besar = akurat tapi lambat) |

---

## ❓ Pemecahan Masalah

- **Kamera tidak bisa dibuka** → pastikan HTTPS/localhost, izinkan kamera, dan
  kamera tidak dipakai aplikasi lain.
- **Wajah tidak dikenali** → daftar ulang dengan pencahayaan baik, atau naikkan
  `MATCH_THRESHOLD` sedikit (mis. `0.55`).
- **Orang lain salah dikenali** → turunkan `MATCH_THRESHOLD` (mis. `0.45`).
- **Data hilang** → data disimpan di `localStorage` per browser/perangkat.
  Jangan hapus data situs; unduh CSV secara rutin.

---

## 🛠️ Teknologi

- HTML, CSS (modern, tanpa framework), JavaScript (vanilla)
- [@vladmandic/face-api](https://github.com/vladmandic/face-api) (TensorFlow.js)
- Web Speech API, MediaDevices API, localStorage
- Hosting: Vercel (static)

---

## Lisensi

Bebas dipakai untuk keperluan belajar. © Kelompok 1 · SMK Al Madani Garut.
