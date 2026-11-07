# 🎭 Game Wayang Kulit Ramayana (Sekonyong Coder)

Game pertarungan (*fighting game*) 2D berbasis seni tradisi Wayang Kulit Jawa berlatar wiracarita epik **Ramayana**. Dibangun menggunakan **Phaser 3**, **TypeScript**, dan **Vite**, game ini menggabungkan mekanisme pertarungan modern dengan estetika kelir, suluk dalang, dan gerak artikulasi sendi wayang (*bone-based ragdoll puppet animation*).

---

## 🌟 Fitur Utama

### 1. ⚔️ Arcade Story Mode (Lakon 6 Babak Lengkap)
- **Alur Sinematik Terpadu**: Alur cerita terintegrasi mulai dari *Film Intro Babak* $\rightarrow$ *Pertarungan di Kelir* $\rightarrow$ *Film Outro / Episode Berikutnya*:
  1. **Babak 1: Aliansi Kiskenda** (Sugriwa vs Subali)
  2. **Babak 2: Penculikan Shinta di Hutan Dandaka** (Jatayu vs Rahwana)
  3. **Babak 3: Anoman Obong** (Hanoman vs Indrajit)
  4. **Babak 4: Pembangunan Tambak Samudra** (Laksmana vs Yuyu Kangkang)
  5. **Babak 5: Perang Puncak Alengka** (Rama vs Kumbakarna)
  6. **Babak 6: Final Round** (Rama vs Rahwana)
- **Rage Combat Cutscene (Amuk Wayang)**:
  - **Player 1 (Amuk Sakti)**: Ketika darah Player 1 mencapai $\le 50\%$, serangan pamungkas memicu cutscene sinematik berdurasi 10 detik dan memotong 50% darah lawan.
  - **CPU / Dalang (Amuk Murka)**: Pada fase darurat (*Boss Phase*, HP $\le 40\%$), CPU memicu amukan bertelegrap visual (getaran layar 1.25 detik) dan memotong 40% darah pemain.
- **Sistem Auto-Revive**: Kebajikan ditakdirkan mengalahkan angkara murka—Player 1 bangkit kembali dengan darah penuh bila kalah dalam pertarungan normal.
- **Rematch Preserving State**: Jika Dalang memenangkan ronde waktu habis (*Time Up*), menekan tombol `J` langsung mengulang babak yang sedang aktif tanpa me-reset kembali ke Babak 1.

### 2. 🏛️ Halaman Promosi Budaya Sendratari Ramayana Prambanan
- **Layar Epilog Paripurna (`PrambananScene.ts`)**: Otomatis tayang setelah video outro Babak 6 selesai diputar.
- **Dynamic QR Code**: Menggunakan pustaka `qrcode` yang merender real-time ke *canvas texture* game menuju [https://injourneydestination.id/](https://injourneydestination.id/).
- **Copywriting Budaya Anti-AI Slop**: Narasi puitis yang mengajak pemain menyaksikan langsung pementasan Sendratari Ramayana di panggung terbuka Candi Prambanan.
- **Tombol Tautan Langsung**: Tombol interaktif klik langsung `🌐 Buka injourneydestination.id ↗` untuk reservasi tiket resmi.

### 3. 🎬 Story Management Tool (CLI Interaktif)
Kelola alur cerita, pemilihan karakter, video babak, dan halaman promosi secara mudah:
```bash
npm run story:admin
# atau: python scripts/story-manager.py
```
- Menentukan jumlah scene/babak pertarungan.
- Memilih karakter Player 1 dan CPU dari daftar karakter yang siap tayang.
- Memilih video intro, outro, dan variasi combo amuk P1 & CPU.
- Mengatur status, teks ajakan, dan URL tujuan QR Code promosi Prambanan.
- Konfigurasi otomatis disimpan ke `src/data/story-config.json` dan langsung aktif di dalam game.

### 4. 🥋 Dojo Uji Coba Rig (Interactive Rig Simulator Lab)
Laboratorium pengujian karakter hasil pemotongan dan penulangan rig:
- **Kontrol Penuh & Dummy AI**: Menguji pukulan, tendangan, lompatan, dan tangkisan melawan boneka latih dengan mode `Idle`, `Guard`, atau `Aggressive`.
- **Debug Hitbox & Skeleton (Tombol `H`)**: Menampilkan visualisasi garis sendi rangka wayang dan kotak tabrakan (*hitbox/hurtbox*) secara real-time.
- **Live Joint Angle Sliders**: Slider pengaturan sudut sendi (kepala, lengan atas, lengan bawah, kaki) untuk kalibrasi visual pivot tanpa reload kode.
- **Instant Character Switcher (Tombol `C`)**: Berganti karakter uji seketika di arena.

### 5. 🤼 Versus Mode & Single Match
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
| **Jatayu** | Burung Garuda suci, ksatria angkasa pelindung Dewi Sinta. | Siap Tanding |
| **Indrajit** | Megananda, putra mahkota Alengka sakti pemilik panah Nagapasa & Keris pusaka. | Siap Tanding |
| **Yuyu Kangkang** | Raja Siluman Kepiting Samudera bercapit emas dan bersaput poleng. | Siap Tanding |
| **Laksmana** | Raden Lakshmana, ksatria agung pemanah Ayodhya pembawa busur Gandewa. | Siap Tanding |
| **Kumbakarna** | Ksatria raksasa agung Alengka bertubuh merah legam pembawa gada pusaka. | Siap Tanding |
| **Rama** | Sri Rama Wijaya, titisan Batara Wisnu, pemanah sakti pembawa busur Gandiwa. | Siap Tanding |

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
| **Aji Triwikrama (Besar)** | `U` |
| **Aji Ekor Api** | `I` |
| **Aji Mengecil** | `O` |

### Player 2 (Kanan - Mode 2P)
| Aksi | Keyboard |
| :--- | :--- |
| **Gerak Kiri / Kanan** | `Panah Kiri` / `Panah Kanan` |
| **Lompat** | `Panah Atas` |
| **Tangkis (Guard)** | `Panah Bawah` |
| **Pukul (Punch)** | `Numpad 1` / `,` |
| **Tendang (Kick)** | `Numpad 2` / `.` |
| **Aji Triwikrama** | `Numpad 4` / `L` |
| **Aji Ekor Api** | `Numpad 5` / `;` |
| **Aji Mengecil** | `Numpad 6` / `'` |

### Shortcut Khusus Dojo & Navigasi
| Fungsi | Tombol |
| :--- | :--- |
| **Toggle Hitbox & Skeleton Debug** | `H` |
| **Ganti Karakter Uji** | `C` |
| **Lewati Cutscene Video (Skip)** | `Space` / `Enter` / `Klik Layar` |
| **Rematch Babak Saat Kalah** | `J` |
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

4. **Jalankan Automated Tests**:
   ```bash
   npm test
   ```

5. **Build untuk produksi**:
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
│   ├── images/             # Gambar dan aset statis
│   └── videos/             # Video cutscene babak & rage combat (MP4/WebM)
├── scripts/
│   ├── build-rig.py        # Script ekstraksi potongan wayang
│   ├── story-manager.py    # Admin CLI pengatur narasi babak cerita
│   └── rigs/               # File konfigurasi JSON rig per karakter
├── src/
│   ├── assets/             # Asset potongan wayang dan sound effects
│   ├── data/
│   │   └── story-config.json # Konfigurasi babak & promosi Prambanan
│   ├── entities/
│   │   ├── Fighter.ts      # Class perakitan sendi, animasi, dan fisika petarung
│   │   └── Controller.ts   # Input mapping (keyboard & gamepad)
│   ├── scenes/
│   │   ├── TitleScene.ts   # Menu utama dengan tombol Arcade Story & Dojo
│   │   ├── FightScene.ts   # Arena pertarungan utama & logika babak
│   │   ├── DojoScene.ts    # Simulator & lab kalibrasi sudut rig karakter
│   │   ├── CinematicScene.ts # Scene pemutar video cutscene intro/outro
│   │   └── PrambananScene.ts # Layar promosi Sendratari Ramayana & dynamic QR
│   ├── systems/            # Bot AI, Effects, Lighting, Gunungan
│   └── main.ts             # Entry point game Phaser 3
├── tests/
│   └── arcade-flow.test.ts # Automated test suite alur cerita & rematch
├── SPEC.md                 # Spesifikasi teknis & perancangan fitur
└── package.json
```

---

## 📜 Lisensi & Hak Cipta
Dikembangkan untuk pelestarian dan reinterpretasi modern wiracarita nusantara.  
Hak Cipta © 2026 **Sekonyong Coder**.
