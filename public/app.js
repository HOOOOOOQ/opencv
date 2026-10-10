/* ============================================================
   ABSENSI KAMERA — Kelompok 1 SMK Al Madani Garut
   Pengenalan wajah 100% di browser (face-api.js).
   Data tersimpan di localStorage perangkat.
   ============================================================ */

(() => {
  'use strict';

  // ------------------------------------------------------------ Konfigurasi
  const CONFIG = {
    MODEL_URL: 'vendor/models',
    SAMPLES_PER_PERSON: 15,       // jumlah sampel saat mendaftar
    MATCH_THRESHOLD: 0.5,         // jarak euclidean; lebih kecil = lebih ketat
    CONFIRMATIONS: 3,             // frame konsisten sebelum dicatat
    DETECT_INPUT_SIZE: 320,       // ukuran input TinyFaceDetector
    DETECT_SCORE: 0.5,
    ENROLL_INTERVAL_MS: 350,
    LATE_AFTER: '07:30',          // lewat jam ini dianggap terlambat
    STORAGE_PEOPLE: 'ak_people_v1',
    STORAGE_ATT: 'ak_attendance_v1',
    STORAGE_THEME: 'ak_theme',
  };

  // ------------------------------------------------------------ Util
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const pad = (n) => String(n).padStart(2, '0');
  const todayStr = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const timeStr = (d = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const fmtDate = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return `${HARI[dt.getDay()]}, ${d} ${BULAN[m - 1]} ${y}`;
  };
  const initials = (name) => name.trim().split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase() || '').join('');
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Polyfill roundRect untuk browser lama
  if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      this.moveTo(x + r, y); this.arcTo(x + w, y, x + w, y + h, r); this.arcTo(x + w, y + h, x, y + h, r);
      this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r); this.closePath(); return this;
    };
  }

  // ------------------------------------------------------------ Toast
  function toast(title, msg = '', type = 'info', ms = 3200) {
    const icons = { success: '✓', error: '!', info: 'i', warn: '!' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<div class="t-icon">${icons[type] || 'i'}</div><div><strong>${escapeHtml(title)}</strong>${msg ? `<small>${escapeHtml(msg)}</small>` : ''}</div>`;
    $('#toasts').appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, ms);
  }

  // ------------------------------------------------------------ Storage
  const store = {
    people: [],
    attendance: {},
    load() {
      try { this.people = JSON.parse(localStorage.getItem(CONFIG.STORAGE_PEOPLE) || '[]'); } catch { this.people = []; }
      try { this.attendance = JSON.parse(localStorage.getItem(CONFIG.STORAGE_ATT) || '{}'); } catch { this.attendance = {}; }
    },
    savePeople() { localStorage.setItem(CONFIG.STORAGE_PEOPLE, JSON.stringify(this.people)); },
    saveAtt() { localStorage.setItem(CONFIG.STORAGE_ATT, JSON.stringify(this.attendance)); },
    findPerson(name) { return this.people.find((p) => p.name.toLowerCase() === name.toLowerCase()); },
    todayList() { return this.attendance[todayStr()] || []; },
    record(person) {
      const date = todayStr();
      const list = this.attendance[date] || (this.attendance[date] = []);
      if (list.some((r) => r.name === person.name)) return false;
      list.push({ name: person.name, class: person.class || '', date, time: timeStr() });
      this.saveAtt();
      return true;
    },
  };

  // ------------------------------------------------------------ Suara
  function speak(text) {
    if (!$('#voiceToggle').checked || !('speechSynthesis' in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'id-ID';
      u.rate = 1;
      const v = speechSynthesis.getVoices().find((v) => v.lang && v.lang.toLowerCase().startsWith('id'));
      if (v) u.voice = v;
      speechSynthesis.speak(u);
    } catch { /* abaikan */ }
  }
  function beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = 880; g.gain.value = 0.08;
      o.connect(g); g.connect(ctx.destination); o.start();
      o.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
      o.stop(ctx.currentTime + 0.3);
    } catch { /* abaikan */ }
  }

  // ------------------------------------------------------------ Kamera
  class Camera {
    constructor(video) { this.video = video; this.stream = null; this.facing = 'user'; }
    async start() {
      this.stop();
      const constraints = { audio: false, video: { facingMode: this.facing, width: { ideal: 640 }, height: { ideal: 480 } } };
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.video.srcObject = this.stream;
      await new Promise((res) => { this.video.onloadedmetadata = () => { this.video.play().then(res).catch(res); }; });
      this.video.style.transform = this.facing === 'user' ? 'scaleX(-1)' : 'none';
    }
    stop() {
      if (this.stream) { this.stream.getTracks().forEach((t) => t.stop()); this.stream = null; }
      this.video.srcObject = null;
    }
    get active() { return !!this.stream; }
    toggleFacing() { this.facing = this.facing === 'user' ? 'environment' : 'user'; }
  }

  function camErrorMsg(e) {
    if (!navigator.mediaDevices) return 'Browser tidak mendukung kamera atau halaman tidak HTTPS.';
    if (e && (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError')) return 'Izin kamera ditolak. Izinkan kamera di pengaturan browser.';
    if (e && e.name === 'NotFoundError') return 'Kamera tidak ditemukan di perangkat ini.';
    if (e && e.name === 'NotReadableError') return 'Kamera sedang dipakai aplikasi lain.';
    return (e && e.message) || 'Tidak dapat mengakses kamera.';
  }

  // ------------------------------------------------------------ Deteksi
  let detectorOptions;
  async function detectAll(video) {
    return faceapi
      .detectAllFaces(video, detectorOptions)
      .withFaceLandmarks(true)
      .withFaceDescriptors();
  }
  async function detectSingle(video) {
    return faceapi
      .detectSingleFace(video, detectorOptions)
      .withFaceLandmarks(true)
      .withFaceDescriptor();
  }
  function drawBox(ctx, box, color, label, mirrored) {
    const { x, y, width, height } = box;
    const bx = mirrored ? ctx.canvas.width - x - width : x;
    ctx.lineWidth = 3; ctx.strokeStyle = color;
    ctx.shadowColor = color; ctx.shadowBlur = 12;
    const r = 12;
    ctx.beginPath();
    ctx.roundRect(bx, y, width, height, r);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // corner accents
    ctx.lineWidth = 5;
    const c = Math.min(22, width / 4);
    [[bx, y, 1, 1], [bx + width, y, -1, 1], [bx, y + height, 1, -1], [bx + width, y + height, -1, -1]].forEach(([cx, cy, sx, sy]) => {
      ctx.beginPath(); ctx.moveTo(cx, cy + sy * c); ctx.lineTo(cx, cy); ctx.lineTo(cx + sx * c, cy); ctx.stroke();
    });
    if (label) {
      ctx.font = '700 15px "Plus Jakarta Sans", sans-serif';
      const padX = 10, h = 28;
      const w = ctx.measureText(label).width + padX * 2;
      const ly = y - h - 8 < 0 ? y + height + 8 : y - h - 8;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.roundRect(bx, ly, w, h, 8); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, bx + padX, ly + h / 2 + 1);
    }
  }
  function fitCanvas(canvas, video) {
    const w = video.videoWidth || 640, h = video.videoHeight || 480;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  }
  function snapshotThumb(video, box, mirrored) {
    const c = document.createElement('canvas');
    const s = 96; c.width = s; c.height = s;
    const ctx = c.getContext('2d');
    const m = 0.2;
    let sx = Math.max(0, box.x - box.width * m), sy = Math.max(0, box.y - box.height * m);
    let sw = Math.min(video.videoWidth - sx, box.width * (1 + 2 * m)), sh = Math.min(video.videoHeight - sy, box.height * (1 + 2 * m));
    if (mirrored) { ctx.translate(s, 0); ctx.scale(-1, 1); }
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, s, s);
    return c.toDataURL('image/jpeg', 0.75);
  }

  // ------------------------------------------------------------ Splash & Model
  async function loadModels() {
    const bar = $('#splashBar'), status = $('#splashStatus');
    const steps = [
      ['Memuat detektor wajah…', () => faceapi.nets.tinyFaceDetector.loadFromUri(CONFIG.MODEL_URL)],
      ['Memuat landmark wajah…', () => faceapi.nets.faceLandmark68TinyNet.loadFromUri(CONFIG.MODEL_URL)],
      ['Memuat model pengenalan…', () => faceapi.nets.faceRecognitionNet.loadFromUri(CONFIG.MODEL_URL)],
    ];
    const t0 = Date.now();
    bar.style.width = '8%';
    for (let i = 0; i < steps.length; i++) {
      status.textContent = steps[i][0];
      await steps[i][1]();
      bar.style.width = `${Math.round(((i + 1) / steps.length) * 90)}%`;
    }
    status.textContent = 'Menyiapkan antarmuka…';
    detectorOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: CONFIG.DETECT_INPUT_SIZE, scoreThreshold: CONFIG.DETECT_SCORE });
    // pemanasan model agar deteksi pertama tidak lambat
    try {
      const c = document.createElement('canvas'); c.width = 160; c.height = 160;
      await faceapi.detectSingleFace(c, detectorOptions);
    } catch { /* abaikan */ }
    bar.style.width = '100%';
    status.textContent = 'Siap!';
    const elapsed = Date.now() - t0;
    if (elapsed < 1600) await sleep(1600 - elapsed);
  }

  // ------------------------------------------------------------ Routing
  const PAGES = ['dashboard', 'daftar', 'absensi', 'kehadiran'];
  function route() {
    let page = (location.hash || '#dashboard').slice(1);
    if (!PAGES.includes(page)) page = 'dashboard';
    $$('.page').forEach((p) => p.classList.toggle('active', p.id === `page-${page}`));
    $$('.nav-link').forEach((a) => a.classList.toggle('active', a.dataset.page === page));
    if (page !== 'daftar') enroll.stop(true);
    if (page !== 'absensi') attend.stop(true);
    if (page === 'dashboard') renderDashboard();
    if (page === 'daftar') renderPeople();
    if (page === 'absensi') renderToday();
    if (page === 'kehadiran') renderAttendance();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ------------------------------------------------------------ Render
  function renderDashboard() {
    const total = store.people.length;
    const today = store.todayList();
    $('#statPeople').textContent = total;
    $('#statToday').textContent = today.length;
    $('#statTodayPct').textContent = total ? `${Math.round((today.length / total) * 100)}% dari terdaftar` : '0%';
    $('#statAbsent').textContent = Math.max(0, total - today.length);
    const now = new Date();
    $('#statDate').textContent = `${now.getDate()} ${BULAN[now.getMonth()]} ${now.getFullYear()}`;
    $('#statDay').textContent = HARI[now.getDay()];

    const feed = $('#recentFeed');
    const items = [...today].reverse().slice(0, 8);
    feed.innerHTML = items.length ? items.map(feedItem).join('') : '<li class="empty">Belum ada kehadiran hari ini.</li>';
  }
  function feedItem(r) {
    const p = store.findPerson(r.name);
    const av = p && p.thumb ? `<img src="${p.thumb}" alt="" />` : escapeHtml(initials(r.name));
    return `<li><div class="avatar">${av}</div><div class="info"><strong>${escapeHtml(r.name)}</strong><small>${escapeHtml(r.class || '—')}</small></div><span class="time">${r.time}</span></li>`;
  }
  function renderToday() {
    const list = store.todayList();
    $('#todayCount').textContent = list.length;
    $('#todayDate').textContent = fmtDate(todayStr());
    $('#todayFeed').innerHTML = list.length ? [...list].reverse().map(feedItem).join('') : '<li class="empty">Belum ada yang absen.</li>';
  }
  function renderPeople() {
    const ul = $('#peopleList');
    $('#peopleCount').textContent = store.people.length;
    if (!store.people.length) { ul.innerHTML = '<li class="empty">Belum ada wajah terdaftar.</li>'; return; }
    ul.innerHTML = store.people.map((p) => `
      <li data-id="${p.id}">
        <div class="avatar">${p.thumb ? `<img src="${p.thumb}" alt="" />` : escapeHtml(initials(p.name))}</div>
        <div class="info"><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.class || '—')} · ${p.descriptors.length} sampel</small></div>
        <button class="del" title="Hapus" data-del="${p.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
      </li>`).join('');
  }
  function renderAttendance() {
    const sel = $('#dateSelect');
    const dates = Object.keys(store.attendance).filter((d) => store.attendance[d].length).sort().reverse();
    if (!dates.includes(todayStr())) dates.unshift(todayStr());
    const prev = sel.value;
    sel.innerHTML = dates.map((d) => `<option value="${d}">${fmtDate(d)}${d === todayStr() ? ' (hari ini)' : ''}</option>`).join('');
    if (dates.includes(prev)) sel.value = prev;
    renderTable();
  }
  function renderTable() {
    const date = $('#dateSelect').value;
    const q = $('#searchInput').value.trim().toLowerCase();
    const rows = (store.attendance[date] || []).filter((r) => !q || r.name.toLowerCase().includes(q) || (r.class || '').toLowerCase().includes(q));
    const tb = $('#attendanceBody');
    if (!rows.length) { tb.innerHTML = '<tr><td colspan="6" class="empty">Tidak ada data.</td></tr>'; return; }
    tb.innerHTML = rows.map((r, i) => {
      const late = r.time > CONFIG.LATE_AFTER + ':00';
      return `<tr><td>${i + 1}</td><td><strong>${escapeHtml(r.name)}</strong></td><td>${escapeHtml(r.class || '—')}</td><td>${r.date}</td><td>${r.time}</td><td><span class="badge ${late ? 'late' : 'ok'}">${late ? 'Terlambat' : 'Hadir'}</span></td></tr>`;
    }).join('');
  }

  // ------------------------------------------------------------ Pendaftaran
  const enroll = {
    cam: null, running: false, descriptors: [], thumb: null, raf: 0, lastSample: 0,
    async start() {
      const name = $('#enrollName').value.trim();
      const cls = $('#enrollClass').value.trim();
      if (name.length < 2) { toast('Nama belum diisi', 'Masukkan nama lengkap minimal 2 huruf.', 'warn'); $('#enrollName').focus(); return; }
      if (store.findPerson(name)) {
        if (!confirm(`"${name}" sudah terdaftar. Daftar ulang & ganti datanya?`)) return;
      }
      try {
        $('#enrollBadge').textContent = 'Membuka kamera…';
        await this.cam.start();
      } catch (e) { toast('Kamera gagal', camErrorMsg(e), 'error', 5000); $('#enrollBadge').textContent = 'Siap'; return; }
      $('#enrollOverlay').classList.add('hide');
      $('#enrollBadge').className = 'cam-badge live'; $('#enrollBadge').textContent = 'Merekam sampel';
      $('#enrollStart').disabled = true; $('#enrollStop').disabled = false;
      $('#enrollName').disabled = true; $('#enrollClass').disabled = true;
      this.descriptors = []; this.thumb = null; this.running = true; this.lastSample = 0;
      this.updateProgress();
      this.loop(name, cls);
    },
    updateProgress() {
      const n = this.descriptors.length, t = CONFIG.SAMPLES_PER_PERSON;
      $('#enrollBar').style.width = `${(n / t) * 100}%`;
      $('#enrollCount').textContent = `${n} / ${t} sampel`;
    },
    async loop(name, cls) {
      const video = $('#enrollVideo'), canvas = $('#enrollCanvas'), ctx = canvas.getContext('2d');
      const mirrored = this.cam.facing === 'user';
      while (this.running) {
        if (video.readyState < 2) { await sleep(60); continue; }
        fitCanvas(canvas, video);
        let det = null;
        try { det = await detectSingle(video); } catch { /* abaikan */ }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (det) {
          const box = det.detection.box;
          const big = box.width > canvas.width * 0.18;
          const now = performance.now();
          if (big && now - this.lastSample > CONFIG.ENROLL_INTERVAL_MS) {
            this.lastSample = now;
            this.descriptors.push(Array.from(det.descriptor));
            if (!this.thumb) this.thumb = snapshotThumb(video, box, mirrored);
            this.updateProgress();
            const wrap = $('#enrollCamWrap'); wrap.classList.remove('flash'); void wrap.offsetWidth; wrap.classList.add('flash');
          }
          drawBox(ctx, box, big ? '#22c55e' : '#f59e0b', big ? `${name} · ${this.descriptors.length}/${CONFIG.SAMPLES_PER_PERSON}` : 'Dekatkan wajah', mirrored);
          $('#enrollHint').textContent = big ? 'Bagus! Gerakkan kepala sedikit ke kiri/kanan/atas/bawah.' : 'Dekatkan wajah ke kamera.';
        } else {
          $('#enrollHint').textContent = 'Wajah tidak terdeteksi. Pastikan pencahayaan cukup.';
        }
        if (this.descriptors.length >= CONFIG.SAMPLES_PER_PERSON) { this.finish(name, cls); return; }
        await sleep(30);
      }
    },
    finish(name, cls) {
      const existing = store.findPerson(name);
      const person = { id: existing ? existing.id : uid(), name, class: cls, descriptors: this.descriptors, thumb: this.thumb, createdAt: new Date().toISOString() };
      if (existing) store.people = store.people.map((p) => (p.id === existing.id ? person : p)); else store.people.push(person);
      store.savePeople();
      attend.invalidateMatcher();
      this.stop();
      $('#enrollName').value = ''; $('#enrollClass').value = '';
      beep();
      toast('Pendaftaran berhasil', `${name} tersimpan dengan ${person.descriptors.length} sampel.`, 'success');
      speak(`${name}, berhasil terdaftar`);
      renderPeople();
    },
    stop(silent) {
      const wasRunning = this.running;
      this.running = false;
      if (this.cam) this.cam.stop();
      const canvas = $('#enrollCanvas'); canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
      $('#enrollOverlay').classList.remove('hide');
      $('#enrollBadge').className = 'cam-badge'; $('#enrollBadge').textContent = 'Siap';
      $('#enrollStart').disabled = false; $('#enrollStop').disabled = true;
      $('#enrollName').disabled = false; $('#enrollClass').disabled = false;
      $('#enrollHint').textContent = 'Hadapkan wajah ke kamera, gerakkan sedikit ke kiri/kanan agar sampel bervariasi.';
      if (wasRunning && !silent && this.descriptors.length < CONFIG.SAMPLES_PER_PERSON) toast('Pendaftaran dibatalkan', '', 'info');
      this.descriptors = []; this.updateProgress();
    },
  };

  // ------------------------------------------------------------ Absensi
  const attend = {
    cam: null, running: false, matcher: null, streaks: {}, lastSeen: {},
    invalidateMatcher() { this.matcher = null; },
    buildMatcher() {
      if (this.matcher) return this.matcher;
      if (!store.people.length) return null;
      const labeled = store.people.map((p) => new faceapi.LabeledFaceDescriptors(p.name, p.descriptors.map((d) => new Float32Array(d))));
      this.matcher = new faceapi.FaceMatcher(labeled, CONFIG.MATCH_THRESHOLD);
      return this.matcher;
    },
    async start() {
      if (!store.people.length) { toast('Belum ada wajah terdaftar', 'Daftarkan wajah terlebih dahulu.', 'warn'); location.hash = '#daftar'; return; }
      try {
        $('#attendBadge').textContent = 'Membuka kamera…';
        await this.cam.start();
      } catch (e) { toast('Kamera gagal', camErrorMsg(e), 'error', 5000); $('#attendBadge').textContent = 'Siap'; return; }
      $('#attendOverlay').classList.add('hide');
      $('#attendBadge').className = 'cam-badge live'; $('#attendBadge').textContent = 'Mendeteksi…';
      $('#attendStart').disabled = true; $('#attendStop').disabled = false;
      this.running = true; this.streaks = {};
      if ('speechSynthesis' in window) speechSynthesis.getVoices();
      this.loop();
    },
    async loop() {
      const video = $('#attendVideo'), canvas = $('#attendCanvas'), ctx = canvas.getContext('2d');
      const matcher = this.buildMatcher();
      let frames = 0, tFps = performance.now();
      while (this.running) {
        if (video.readyState < 2) { await sleep(60); continue; }
        const mirrored = this.cam.facing === 'user';
        fitCanvas(canvas, video);
        let dets = [];
        try { dets = await detectAll(video); } catch { /* abaikan */ }
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const seen = new Set();
        for (const d of dets) {
          const m = matcher.findBestMatch(d.descriptor);
          const known = m.label !== 'unknown';
          const pct = Math.max(0, Math.round((1 - m.distance) * 100));
          let color = '#ef4444', label = `Tidak dikenal`;
          if (known) {
            seen.add(m.label);
            this.streaks[m.label] = (this.streaks[m.label] || 0) + 1;
            const confirmed = this.streaks[m.label] >= CONFIG.CONFIRMATIONS;
            if (confirmed) {
              color = '#22c55e'; label = `${m.label} · ${pct}%`;
              this.handleRecognized(m.label);
            } else { color = '#f59e0b'; label = `Memastikan: ${m.label}`; }
          }
          drawBox(ctx, d.detection.box, color, label, mirrored);
        }
        for (const k of Object.keys(this.streaks)) if (!seen.has(k)) this.streaks[k] = 0;

        const badge = $('#attendBadge');
        if (!dets.length) { badge.className = 'cam-badge live'; badge.textContent = 'Mencari wajah…'; }
        else if (seen.size) { badge.className = 'cam-badge ok'; badge.textContent = `${seen.size} wajah dikenali`; }
        else { badge.className = 'cam-badge warn'; badge.textContent = 'Wajah tidak dikenal'; }

        frames++;
        const now = performance.now();
        if (now - tFps > 1000) { $('#attendFps').textContent = `${frames} fps`; frames = 0; tFps = now; }
        await sleep(10);
      }
    },
    handleRecognized(name) {
      const now = Date.now();
      if (this.lastSeen[name] && now - this.lastSeen[name] < 4000) return;
      this.lastSeen[name] = now;
      const person = store.findPerson(name);
      if (!person) return;
      if (store.record(person)) {
        beep();
        toast('Absensi tercatat', `${name} · ${timeStr()}`, 'success');
        speak(`${name}, terabsen`);
        renderToday();
      } else {
        toast(`${name} sudah absen hari ini`, '', 'info', 2000);
      }
    },
    stop(silent) {
      this.running = false;
      if (this.cam) this.cam.stop();
      const canvas = $('#attendCanvas'); canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
      $('#attendOverlay').classList.remove('hide');
      $('#attendBadge').className = 'cam-badge'; $('#attendBadge').textContent = 'Siap';
      $('#attendFps').textContent = '';
      $('#attendStart').disabled = false; $('#attendStop').disabled = true;
    },
  };

  // ------------------------------------------------------------ Export CSV
  function exportCsv() {
    const date = $('#dateSelect').value;
    const rows = store.attendance[date] || [];
    if (!rows.length) { toast('Tidak ada data', 'Belum ada kehadiran pada tanggal ini.', 'warn'); return; }
    const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = ['No,Nama,Kelas,Tanggal,Waktu,Status', ...rows.map((r, i) => [i + 1, r.name, r.class || '', r.date, r.time, r.time > CONFIG.LATE_AFTER + ':00' ? 'Terlambat' : 'Hadir'].map(esc).join(','))].join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `kehadiran_${date}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('CSV diunduh', `kehadiran_${date}.csv`, 'success');
  }

  // ------------------------------------------------------------ Tema & Jam
  function applyTheme(t) { document.documentElement.setAttribute('data-theme', t); localStorage.setItem(CONFIG.STORAGE_THEME, t); $('meta[name=theme-color]').setAttribute('content', t === 'light' ? '#f3f5fb' : '#0b1020'); }
  function tickClock() { $('#clock').textContent = timeStr(); }

  // ------------------------------------------------------------ Init
  async function init() {
    applyTheme(localStorage.getItem(CONFIG.STORAGE_THEME) || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));
    store.load();
    $('#year').textContent = new Date().getFullYear();
    tickClock(); setInterval(tickClock, 1000);

    enroll.cam = new Camera($('#enrollVideo'));
    attend.cam = new Camera($('#attendVideo'));

    // Events
    window.addEventListener('hashchange', route);
    $('#themeToggle').addEventListener('click', () => applyTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light'));
    $('#enrollStart').addEventListener('click', () => enroll.start());
    $('#enrollStop').addEventListener('click', () => enroll.stop());
    $('#enrollName').addEventListener('keydown', (e) => { if (e.key === 'Enter') enroll.start(); });
    $('#attendStart').addEventListener('click', () => attend.start());
    $('#attendStop').addEventListener('click', () => attend.stop());
    $('#switchCam').addEventListener('click', async () => {
      attend.cam.toggleFacing(); enroll.cam.facing = attend.cam.facing;
      if (attend.running) { try { await attend.cam.start(); } catch (e) { toast('Kamera gagal', camErrorMsg(e), 'error'); } }
      toast('Kamera', attend.cam.facing === 'user' ? 'Kamera depan' : 'Kamera belakang', 'info', 1500);
    });
    $('#peopleList').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-del]'); if (!btn) return;
      const p = store.people.find((x) => x.id === btn.dataset.del); if (!p) return;
      if (!confirm(`Hapus data wajah "${p.name}"?`)) return;
      store.people = store.people.filter((x) => x.id !== p.id); store.savePeople(); attend.invalidateMatcher();
      renderPeople(); toast('Dihapus', p.name, 'info');
    });
    $('#clearPeople').addEventListener('click', () => {
      if (!store.people.length) return;
      if (!confirm('Hapus SEMUA data wajah terdaftar?')) return;
      store.people = []; store.savePeople(); attend.invalidateMatcher(); renderPeople(); toast('Semua data wajah dihapus', '', 'info');
    });
    $('#dateSelect').addEventListener('change', renderTable);
    $('#searchInput').addEventListener('input', renderTable);
    $('#exportCsv').addEventListener('click', exportCsv);
    $('#deleteDate').addEventListener('click', () => {
      const date = $('#dateSelect').value;
      if (!(store.attendance[date] || []).length) { toast('Tidak ada data', '', 'warn'); return; }
      if (!confirm(`Hapus semua kehadiran tanggal ${fmtDate(date)}?`)) return;
      delete store.attendance[date]; store.saveAtt(); renderAttendance(); toast('Data tanggal dihapus', '', 'info');
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { enroll.stop(true); attend.stop(true); } });

    // Load models (splash)
    try {
      if (typeof faceapi === 'undefined') throw new Error('Library face-api gagal dimuat.');
      await loadModels();
    } catch (e) {
      $('#splashStatus').textContent = 'Gagal memuat model: ' + (e.message || e);
      $('#splashBar').style.background = 'var(--danger)';
      toast('Gagal memuat model', 'Periksa koneksi lalu muat ulang halaman.', 'error', 8000);
      console.error(e);
    }

    $('#app').classList.remove('hidden');
    route();
    $('#splash').classList.add('hide');
    setTimeout(() => $('#splash').remove(), 800);

    if (!window.isSecureContext) toast('Perlu HTTPS', 'Kamera hanya bisa diakses lewat HTTPS atau localhost.', 'warn', 6000);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
