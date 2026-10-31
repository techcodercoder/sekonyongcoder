# 🎭 Hanoman: Wayang Kulit Fighting Game (Sekonyong Coder)

Game pertarungan (*fighting game*) 2D berbasis seni tradisi Wayang Kulit Jawa berlatar wiracarita epik **Ramayana**. Dibangun menggunakan **Phaser 3**, **TypeScript**, dan **Vite**, game ini menggabungkan mekanisme pertarungan modern dengan estetika kelir, suluk dalang, dan gerak artikulasi sendi wayang (*bone-based ragdoll puppet animation*).

---

## 🌟 Fitur Utama

### 1. ⚔️ Arcade Story Mode (Lakon Ramayana)
- **Alur Sinematik Babak demi Babak**: Alur cerita terintegrasi mulai dari *Film Intro Babak* $\rightarrow$ *Pertarungan di Kelir* $\rightarrow$ *Film Outro / Episode Berikutnya*.
- **Rage Combat Cutscene (Amuk Wayang)**: Ketika darah Player 1 mencapai $\le 50\%$, serangan pamungkas memicu *cutscene* sinematik berdurasi 10 detik dan memotong darah lawan sebesar 50%.
- **Sistem Auto-Revive**: Kebajikan ditakdirkan mengalahkan angkara murka—Player 1 bangkit kembali dengan darah penuh bila kalah, sehingga cerita dapat diselesaikan sampai paripurna.

### 2. 🎬 Story Management Tool (CLI Interaktif)
Kelola alur cerita dan pertarungan antar babak secara mudah tanpa perlu menulis kode:
```bash
npm run story:admin
# atau: python scripts/story-manager.py
```
- Menentukan jumlah scene/babak pertarungan.
- Memilih karakter Player 1 dan CPU dari daftar karakter yang siap tayang di repositori.
- Memilih file video intro, outro, dan cutscene amuk dari `public/videos/`.
- Konfigurasi otomatis disimpan ke `src/data/story-config.json` dan langsung aktif di dalam game.

### 3. 🥋 Dojo Uji Coba Rig (Interactive Rig Simulator Lab)
Laboratorium pengujian karakter hasil pemotongan dan penulangan rig:
- **Kontrol Penuh & Dummy AI**: Menguji pukulan, tendangan, lompatan, dan tangkisan melawan boneka latih dengan mode `Idle`, `Guard`, atau `Aggressive`.
- **Debug Hitbox & Skeleton (Tombol `H`)**: Menampilkan visualisasi garis sendi rangka wayang dan kotak tabrakan (*hitbox/hurtbox*) secara real-time.
- **Live Joint Angle Sliders**: Slider pengaturan sudut sendi (kepala, lengan atas, lengan bawah, kaki) untuk kalibrasi visual pivot tanpa reload kode.
- **Instant Character Switcher (Tombol `C`)**: Berganti karakter uji seketika di arena.

### 4. 🤼 Versus Mode & Single Match
- **Lawan Dalang**: Pertarungan cepat 1 lawan 1 menghadapi AI komputer.
- **Dua Pemain (2P Local)**: Bertarung bersama teman di satu keyboard.

---

## 🐵 Daftar Karakter

| Karakter | Gelar / Deskripsi | Status Rig |
| :--- | :--- | :--- |
| **Hanoman** | Kera Putih, pahlawan ksatria angin pembawa pesan Prabu Rama. | Siap Tanding |
| **Sugriwa** | Raja Kera Gua Kiskenda, berbulu merah keemasan. | Siap Tanding |
| **Subali** | Resi Wanara sakti pemilik Aji Pancasona. | Siap Tanding |
| **Rahwana** | Prabu Dasamuka, raja raksasa Alengka berkepala sepuluh. | Siap Tanding |

---

## 🎮 Kontrol Permainan

### Player 1 (Kiri)
| Aksi | Keyboard |
| :--- | :--- |
| **Gerak Kiri / Kanan** | `A` / `D` |
| **Lompat** | `W` |
| **Tangkis (Guard)** | `S` |
| **Pukul (Punch)** | `J` |
| **Tendang (Kick)** | `K` |
| **Cempala / Amuk** | `L` |

### Player 2 (Kanan - Mode 2P)
| Aksi | Keyboard |
| :--- | :--- |
| **Gerak Kiri / Kanan** | `Panah Kiri` / `Panah Kanan` |
| **Lompat** | `Panah Atas` |
| **Tangkis (Guard)** | `Panah Bawah` |
| **Pukul (Punch)** | `Numpad 1` |
| **Tendang (Kick)** | `Numpad 2` |

### Shortcut Khusus Dojo & Sinematik
| Fungsi | Tombol |
| :--- | :--- |
| **Toggle Hitbox & Skeleton Debug** | `H` |
| **Ganti Karakter Uji** | `C` |
| **Lewati Cutscene Video (Skip)** | `Space` / `Enter` / `Klik Layar` |
| **Kembali ke Menu Utama** | `Escape` |

---

## 🚀 Memulai Proyek (Getting Started)

### Prasyarat
- [Node.js](https://nodejs.org/) (versi 18 atau lebih baru)
- [Python](https://www.python.org/) 3.9+ (dengan modul `Pillow` untuk skrip ekstraksi rig)

### Instalasi & Menjalankan Game
1. **Clone repository**:
   ```bash
   git clone https://github.com/HaninSM/sekonyongcoder.git
   cd sekonyongcoder
   ```
2. **Install dependency**:
   ```bash
   npm install
   ```
3. **Jalankan development server**:
   ```bash
   npm run dev
   ```
   Buka browser di alamat `http://localhost:5173`.

4. **Build untuk produksi**:
   ```bash
   npm run build
   ```

---

## 🛠️ Pipeline Ekstraksi Rig Wayang (`build-rig.py`)

Game ini menggunakan sistem pemotongan otomatis lembar gambar mentah menjadi potongan anggota tubuh wayang (*joints/pieces*):
```bash
python scripts/build-rig.py scripts/rigs/<karakter>.json [preview-output.png]
```
Contoh:
```bash
python scripts/build-rig.py scripts/rigs/sugriwa.json preview-sugriwa.png
```
Konfigurasi rig mendefinisikan titik *pivot*, *seed point* ekstraksi warna transparan, dan poligon pembatas sendi (*drop* & *keep masks*) agar ruas lengan dan kaki terpotong akurat tanpa duplikasi.

---

## 📂 Struktur Proyek

```
sekonyongcoder/
├── assets-src/             # Gambar sumber/mentah lembar wayang
├── public/
│   └── videos/             # Video cutscene babak & rage combat (MP4/WebM)
├── scripts/
│   ├── build-rig.py        # Script ekstraksi potongan wayang
│   ├── story-manager.py    # Admin CLI pengatur narasi babak cerita
│   └── rigs/               # File konfigurasi JSON rig per karakter
├── src/
│   ├── assets/             # Asset potongan wayang dan sound effects
│   ├── data/
│   │   └── story-config.json # Konfigurasi babak yang aktif
│   ├── entities/
│   │   ├── Fighter.ts      # Class perakitan sendi, animasi, dan fisika petarung
│   │   └── Controller.ts   # Input mapping (keyboard & gamepad)
│   ├── scenes/
│   │   ├── TitleScene.ts   # Menu utama dengan tombol Arcade Story & Dojo
│   │   ├── FightScene.ts   # Arena pertarungan utama & logika ronde
│   │   ├── DojoScene.ts    # Simulator & lab kalibrasi sudut rig karakter
│   │   └── CinematicScene.ts # Scene pemutar video cutscene intro/outro
│   └── main.ts             # Entry point game Phaser 3
├── SPEC.md                 # Spesifikasi teknis & perancangan fitur
└── package.json
```

---

## 📜 Lisensi & Hak Cipta
Dikembangkan untuk pelestarian dan reinterpretasi modern wiracarita nusantara.
Hak Cipta © 2026 **Sekonyong Coder**.
