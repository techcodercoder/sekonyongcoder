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


def choose_from_list(prompt_text, items, allow_custom=False, default_idx=None):
    """Menampilkan pilihan bernomor ke terminal dan mengembalikan item yang dipilih."""
    print(f"\n{prompt_text}")
    for idx, item in enumerate(items, 1):
        suffix = " (default)" if default_idx == idx else ""
        print(f"  [{idx}] {item}{suffix}")
    if allow_custom:
        print(f"  [0] Ketik nama file sendiri secara manual")

    while True:
        try:
            hint = f" [default: {default_idx}]" if default_idx is not None else ""
            choice = input(f"Pilih nomor{hint}: ").strip()
            if not choice and default_idx is not None and 1 <= default_idx <= len(items):
                return items[default_idx - 1]
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


def prompt_yes_no(label, default=True):
    """Input pertanyaan Yes/No."""
    hint = "Y/n" if default else "y/N"
    while True:
        try:
            res = input(f"{label} [{hint}]: ").strip().lower()
            if not res:
                return default
            if res in ["y", "yes", "ya", "1"]:
                return True
            if res in ["n", "no", "tidak", "0"]:
                return False
            print("Harap ketik 'y' atau 'n'.")
        except (KeyboardInterrupt, EOFError):
            print("\nProses dibatalkan.")
            sys.exit(0)


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

        # Film Rage Combat Player 1
        print(f"\n[RAGE COMBAT] Konfigurasi Amuk Wayang Babak {i}:")
        if videos:
            p1_rage_1 = choose_from_list(
                f"Pilih File Video Amuk / Rage Combat PLAYER 1 ({p1.upper()}) Babak {i}:",
                videos,
                default_idx=1,
                allow_custom=True
            )
            p1_rage_vids = [p1_rage_1]
            if len(videos) > 1 and prompt_yes_no(f"Tambah variasi video Amuk kedua untuk PLAYER 1 ({p1.upper()})?", default=False):
                p1_rage_2 = choose_from_list(
                    f"Pilih Video Amuk PLAYER 1 Variasi 2:",
                    videos,
                    default_idx=2 if len(videos) > 1 else 1,
                    allow_custom=True
                )
                p1_rage_vids.append(p1_rage_2)
        else:
            p1_rage_1 = prompt_text(f"File Video Amuk PLAYER 1 ({p1.upper()})", "combo_1_sugriwa_ke_subali.mp4")
            p1_rage_vids = [p1_rage_1]

        # Film Rage Combat CPU (Dalang)
        cpu_rage_enabled = prompt_yes_no(f"Aktifkan fitur Amuk Murka untuk CPU ({cpu.upper()}) di Babak {i}?", default=True)
        cpu_rage_vids = []
        if cpu_rage_enabled:
            if videos:
                cpu_rage_1 = choose_from_list(
                    f"Pilih File Video Amuk / Rage Combat CPU ({cpu.upper()}) Babak {i}:",
                    videos,
                    default_idx=2 if len(videos) > 1 else 1,
                    allow_custom=True
                )
                cpu_rage_vids = [cpu_rage_1]
                if len(videos) > 1 and prompt_yes_no(f"Tambah variasi video Amuk kedua untuk CPU ({cpu.upper()})?", default=False):
                    cpu_rage_2 = choose_from_list(
                        f"Pilih Video Amuk CPU Variasi 2:",
                        videos,
                        default_idx=1,
                        allow_custom=True
                    )
                    cpu_rage_vids.append(cpu_rage_2)
            else:
                cpu_rage_1 = prompt_text(f"File Video Amuk CPU ({cpu.upper()})", "combo_2_sugriwa_ke_subali.mp4")
                cpu_rage_vids = [cpu_rage_1]

        def format_vids(v_list):
            return [f"/videos/{v}" if not v.startswith("/") else v for v in v_list]

        chapter_data = {
            "chapterIndex": i,
            "title": title,
            "subtitle": subtitle,
            "player1": p1,
            "cpu": cpu,
            "introVideo": f"/videos/{intro_file}" if not intro_file.startswith("/") else intro_file,
            "outroVideo": f"/videos/{outro_file}" if not outro_file.startswith("/") else outro_file,
            "playerRageVideos": format_vids(p1_rage_vids),
            "cpuRageEnabled": cpu_rage_enabled,
            "cpuRageVideos": format_vids(cpu_rage_vids),
            "rageVideos": format_vids(p1_rage_vids + cpu_rage_vids)
        }
        chapters.append(chapter_data)
        print(f"[OK] Babak {i} ({title}: {p1} vs {cpu}) berhasil dikonfigurasi!")

    # Baca konfigurasi lama jika ada untuk mempertahankan prambananPromo
    existing_promo = {}
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                old_data = json.load(f)
                existing_promo = old_data.get("prambananPromo", {})
        except Exception:
            pass

    print("\n" + "=" * 50)
    print("[HALAMAN PROMOSI SENDRATARI RAMAYANA PRAMBANAN]")
    print("=" * 50)
    default_promo = {
        "enabled": True,
        "badge": "SENDRATARI RAMAYANA PRAMBANAN",
        "headline": "Kamu Sudah Memainkannya.\nSekarang, Duduklah dan Saksikan Mereka Menari.",
        "bodyText": "Menggerakkan Hanoman melompati kelir layar hanyalah permulaan.\n\nDi pelataran Candi Prambanan, kisah ini dipentaskan tanpa sepatah kata pun—hanya tatapan mata ksatria, ayunan pedang raksasa, dan gemuruh kendang yang mengunci ratusan pasang mata penonton dunia sejak 1961.\n\nHadir dan jadilah saksi langsung epik terbesar tanah Jawa di panggung terbuka termegah nusantara.",
        "ctaText": "Pindai untuk reservasi kursi pertunjukan via injourneydestination.id",
        "qrUrl": "https://injourneydestination.id/"
    }
    promo = existing_promo if existing_promo else default_promo

    promo_enabled = prompt_yes_no("Aktifkan Halaman Promosi Sendratari Prambanan di akhir Arcade?", default=promo.get("enabled", True))
    promo["enabled"] = promo_enabled

    if promo_enabled:
        if prompt_yes_no("Apakah ingin menyesuaikan URL QRCode atau teks ajakan?", default=False):
            promo["badge"] = prompt_text("Badge / Label", promo.get("badge", default_promo["badge"]))
            promo["headline"] = prompt_text("Headline Utama", promo.get("headline", default_promo["headline"]))
            promo["qrUrl"] = prompt_text("URL Tujuan QRCode", promo.get("qrUrl", default_promo["qrUrl"]))
            promo["ctaText"] = prompt_text("Teks Ajakan CTA", promo.get("ctaText", default_promo["ctaText"]))

    # Simpan ke src/data/story-config.json
    CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
    full_config = {
        "totalChapters": len(chapters),
        "chapters": chapters,
        "prambananPromo": promo
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
        print(f"    - P1 Amuk Videos: {', '.join(ch.get('playerRageVideos', ch.get('rageVideos', [])))}")
        cpu_enabled = ch.get('cpuRageEnabled', True)
        print(f"    - CPU Amuk: {'Aktif' if cpu_enabled else 'Nonaktif'}")
        if cpu_enabled and ch.get('cpuRageVideos'):
            print(f"    - CPU Amuk Videos: {', '.join(ch['cpuRageVideos'])}")
        print()


if __name__ == "__main__":
    main()
