#!/usr/bin/env python3
"""
Management Narasi Cerita (Story Management CLI Tool)
Digunakan oleh Admin untuk menyusun alur babak cerita (Story Mode):
1. Menentukan jumlah scene combat
2. Memilih karakter Player 1 (kiri) & CPU (kanan) dari folder karakter yang siap tayang
3. Menentukan file film intro, outro, dan rage combat
Menyimpan konfigurasi ke: src/data/story-config.json
"""

import os
import sys
import json
from pathlib import Path

# Pastikan output utf-8 aman di Windows terminal
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stdin.reconfigure(encoding="utf-8")
    except Exception:
        pass

ROOT_DIR = Path(__file__).resolve().parent.parent
CHAR_DIR = ROOT_DIR / "src" / "assets" / "characters"
VIDEO_DIR = ROOT_DIR / "public" / "videos"
CONFIG_FILE = ROOT_DIR / "src" / "data" / "story-config.json"


def get_ready_characters():
    """Mendeteksi karakter yang siap tayang di folder src/assets/characters."""
    ready = []
    if not CHAR_DIR.exists():
        return ready

    for item in sorted(CHAR_DIR.iterdir()):
        if item.is_dir():
            rig_file = item / "rig.json"
            # Karakter siap jika memiliki rig.json atau gambar potongan
            if rig_file.exists() or any(item.glob("*.png")):
                ready.append(item.name)
        elif item.is_file() and item.suffix.lower() == ".png":
            name = item.stem
            if name not in ready:
                ready.append(name)
    return ready


def get_available_videos():
    """Mendeteksi file video di folder public/videos/."""
    VIDEO_DIR.mkdir(parents=True, exist_ok=True)
    videos = []
    for ext in ("*.mp4", "*.webm", "*.mov"):
        videos.extend([f.name for f in VIDEO_DIR.glob(ext)])
    return sorted(videos)


def choose_from_list(prompt_text, items, allow_custom=False):
    """Menampilkan pilihan bernomor ke terminal dan mengembalikan item yang dipilih."""
    print(f"\n{prompt_text}")
    for idx, item in enumerate(items, 1):
        print(f"  [{idx}] {item}")
    if allow_custom:
        print(f"  [0] Ketik nama file sendiri secara manual")

    while True:
        try:
            choice = input("Pilih nomor: ").strip()
            if allow_custom and choice == "0":
                custom = input("Masukkan nama file video (contoh: babak1.mp4): ").strip()
                if custom:
                    return custom
            num = int(choice)
            if 1 <= num <= len(items):
                return items[num - 1]
            print(f"Pilihan tidak valid. Masukkan angka 1 sampai {len(items)}.")
        except ValueError:
            print("Harap masukkan angka yang valid.")
        except (KeyboardInterrupt, EOFError):
            print("\nProses dibatalkan.")
            sys.exit(0)


def prompt_text(label, default=""):
    """Input teks dengan nilai default."""
    if default:
        res = input(f"{label} [default: {default}]: ").strip()
        return res if res else default
    else:
        while True:
            res = input(f"{label}: ").strip()
            if res:
                return res
            print("Nilai tidak boleh kosong.")


def main():
    print("=" * 65)
    print("   [+] MANAGEMENT NARASI CERITA - RAMAYANA ARCADE STORY [+]")
    print("=" * 65)

    # 1. Deteksi karakter yang siap tayang
    characters = get_ready_characters()
    if not characters:
        print("[!] Error: Tidak ada karakter yang ditemukan di src/assets/characters/!")
        return

    print(f"\n[OK] Ditemukan {len(characters)} karakter siap tayang:")
    for c in characters:
        print(f"   * {c}")

    # 2. Deteksi video yang ada
    videos = get_available_videos()
    if videos:
        print(f"\n[VIDEO] Ditemukan {len(videos)} file video di public/videos/:")
        for v in videos:
            print(f"   * {v}")
    else:
        print(f"\n[INFO] Belum ada file video di public/videos/. Anda dapat mengetikkan nama file manual.")

    # Pertanyaan 1: Ada berapa scene combat?
    print("\n" + "-" * 50)
    while True:
        try:
            combat_count_str = input(">> 1. Ada berapa scene combat? (contoh: 2): ").strip()
            combat_count = int(combat_count_str)
            if combat_count > 0:
                break
            print("Jumlah scene combat minimal 1.")
        except ValueError:
            print("Harap masukkan angka bilangan bulat.")
        except (KeyboardInterrupt, EOFError):
            print("\nDibatalkan.")
            return

    chapters = []

    # Pertanyaan 2 & 3: Loop untuk setiap scene combat
    for i in range(1, combat_count + 1):
        print("\n" + "=" * 50)
        print(f"[SCENE COMBAT {i} DARI {combat_count}]")
        print("=" * 50)

        title = prompt_text(f"Judul Babak {i}", f"Babak {i}")
        subtitle = prompt_text(f"Sub-judul / Latar Babak {i}", "Pertarungan di Kelir")

        # Karakter Player 1 (Kiri)
        p1 = choose_from_list(
            f">> Karakter Player 1 (Sebelah KIRI) untuk Scene {i}:",
            characters
        )

        # Karakter CPU (Kanan)
        cpu = choose_from_list(
            f">> Karakter CPU (Sebelah KANAN) untuk Scene {i}:",
            characters
        )

        print(f"\n[FILM] Pemilihan File Film Babak {i}:")
        
        # Film Intro
        default_intro = f"intro_babak_{i}.mp4"
        if videos:
            intro_file = choose_from_list(
                f"Pilih File Film INTRO Babak {i}:",
                videos,
                allow_custom=True
            )
        else:
            intro_file = prompt_text("Nama File Film INTRO (di folder public/videos/)", default_intro)

        # Film Outro
        default_outro = f"outro_babak_{i}.mp4"
        if videos:
            outro_file = choose_from_list(
                f"Pilih File Film OUTRO / Episode Berikutnya Babak {i}:",
                videos,
                allow_custom=True
            )
        else:
            outro_file = prompt_text("Nama File Film OUTRO (di folder public/videos/)", default_outro)

        # Film Rage Combat (default 1 & 2)
        rage_1 = prompt_text("File Video Rage Combat 1", "rage_combat_1.mp4")
        rage_2 = prompt_text("File Video Rage Combat 2", "rage_combat_2.mp4")

        chapter_data = {
            "chapterIndex": i,
            "title": title,
            "subtitle": subtitle,
            "player1": p1,
            "cpu": cpu,
            "introVideo": f"/videos/{intro_file}" if not intro_file.startswith("/") else intro_file,
            "outroVideo": f"/videos/{outro_file}" if not outro_file.startswith("/") else outro_file,
            "rageVideos": [
                f"/videos/{rage_1}" if not rage_1.startswith("/") else rage_1,
                f"/videos/{rage_2}" if not rage_2.startswith("/") else rage_2
            ]
        }
        chapters.append(chapter_data)
        print(f"[OK] Babak {i} ({title}: {p1} vs {cpu}) berhasil dikonfigurasi!")

    # Simpan ke src/data/story-config.json
    CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
    full_config = {
        "totalChapters": len(chapters),
        "chapters": chapters
    }

    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(full_config, f, indent=2, ensure_ascii=False)

    print("\n" + "=" * 65)
    print(f"[SELESAI] Konfigurasi narasi cerita telah disimpan ke:")
    print(f"   --> {CONFIG_FILE.relative_to(ROOT_DIR)}")
    print("=" * 65)
    print("\nRingkasan Alur Cerita yang Disimpan:")
    for ch in chapters:
        print(f"  * Babak {ch['chapterIndex']}: {ch['title']}")
        print(f"    - Laga: {ch['player1']} (P1 Kiri) VS {ch['cpu']} (CPU Kanan)")
        print(f"    - Intro Film: {ch['introVideo']}")
        print(f"    - Outro Film: {ch['outroVideo']}")
        print(f"    - Rage Videos: {', '.join(ch['rageVideos'])}")
        print()


if __name__ == "__main__":
    main()
