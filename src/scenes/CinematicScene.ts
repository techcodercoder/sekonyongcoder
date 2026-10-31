import Phaser from 'phaser';
import gsap from 'gsap';
import { COLORS, GAME, KELIR } from '../constants';
import { textStyle } from '../systems/Effects';
import { drawGunungan, preloadGunungan } from '../systems/Gunungan';
import { Lighting } from '../systems/Lighting';

export interface CinematicData {
  badge?: string;
  title: string;
  subtitle: string;
  videoUrl?: string;
  durationSeconds?: number;
  onComplete: () => void;
  characterImg?: string;
}

export class CinematicScene extends Phaser.Scene {
  private configData!: CinematicData;
  private isFinishing = false;
  private videoEl?: HTMLVideoElement;

  constructor() {
    super('CinematicScene');
  }

  preload(): void {
    preloadGunungan(this);
  }

  create(data: CinematicData): void {
    this.configData = data;
    this.isFinishing = false;
    new Lighting(this);

    const floorTop = GAME.height - KELIR.floorHeight;
    this.add.rectangle(GAME.width / 2, floorTop + KELIR.floorHeight / 2, GAME.width, KELIR.floorHeight, COLORS.gedebog);

    const kayon = drawGunungan(this, GAME.width / 2, 320, 360).setDepth(10);
    gsap.to(kayon, { angle: 3, duration: 2.2, yoyo: true, repeat: -1, ease: 'sine.inOut' });

    // Badge (e.g. "FILM INTRO", "RAGE COMBAT", "FILM OUTRO")
    const badgeText = data.badge ?? 'LAKON RAMAYANA';
    this.add
      .text(GAME.width / 2, 70, `[ ${badgeText} ]`, {
        ...textStyle(18),
        color: '#f5c451',
      })
      .setOrigin(0.5)
      .setDepth(101);

    // Title & Subtitle
    this.add.text(GAME.width / 2, 115, data.title, textStyle(38)).setOrigin(0.5).setDepth(101);
    this.add
      .text(GAME.width / 2, 165, data.subtitle, {
        fontFamily: 'Georgia, serif',
        fontSize: '18px',
        color: '#f2d49b',
        fontStyle: 'italic',
      })
      .setOrigin(0.5)
      .setDepth(101);

    // Skip Button / Hint
    const skipBtn = this.add
      .rectangle(GAME.width / 2, GAME.height - 40, 340, 36, 0x1c110a, 0.8)
      .setStrokeStyle(2, 0xf5c451)
      .setDepth(102)
      .setInteractive({ useHandCursor: true });

    this.add
      .text(GAME.width / 2, GAME.height - 40, 'TEKAN [SPASI / ENTER / KLIK] UNTUK LEWATI', {
        fontFamily: 'Georgia, serif',
        fontSize: '13px',
        color: '#f2d49b',
      })
      .setOrigin(0.5)
      .setDepth(103);

    skipBtn.on('pointerdown', () => this.finish());

    // Try HTML5 Video Playback if file is provided
    let hasPlayingVideo = false;
    if (data.videoUrl) {
      hasPlayingVideo = this.tryPlayVideo(data.videoUrl);
    }

    // Fallback timer if no video plays or video finishes
    const duration = data.durationSeconds ?? (data.badge?.includes('RAGE') ? 10 : 6);
    this.add.rectangle(GAME.width / 2, 210, 400, 6, 0x4a3a1c).setDepth(101);
    const progressBar = this.add.rectangle(GAME.width / 2 - 200, 210, 0, 6, 0xf5c451).setOrigin(0, 0.5).setDepth(102);

    gsap.to(progressBar, {
      width: 400,
      duration,
      ease: 'linear',
      onComplete: () => {
        if (!hasPlayingVideo) this.finish();
      },
    });

    const kb = this.input.keyboard!;
    kb.once('keydown-SPACE', () => this.finish());
    kb.once('keydown-ENTER', () => this.finish());
    this.input.once('pointerdown', () => this.finish());
  }

  private tryPlayVideo(url: string): boolean {
    try {
      const vid = document.createElement('video');
      vid.src = url;
      vid.autoplay = true;
      vid.muted = false;
      vid.style.position = 'absolute';
      vid.style.top = '10%';
      vid.style.left = '15%';
      vid.style.width = '70%';
      vid.style.height = '70%';
      vid.style.zIndex = '1000';
      vid.style.borderRadius = '12px';
      vid.style.border = '3px solid #f5c451';
      vid.style.boxShadow = '0 0 25px rgba(245, 196, 81, 0.6)';

      vid.onended = () => this.finish();
      vid.onerror = () => {
        vid.remove();
      };

      document.body.appendChild(vid);
      this.videoEl = vid;
      vid.play().catch(() => {
        vid.muted = true;
        vid.play().catch(() => vid.remove());
      });
      return true;
    } catch {
      return false;
    }
  }

  private finish(): void {
    if (this.isFinishing) return;
    this.isFinishing = true;

    if (this.videoEl) {
      this.videoEl.pause();
      this.videoEl.remove();
      this.videoEl = undefined;
    }

    gsap.killTweensOf(this);
    this.cameras.main.fade(300, 28, 17, 10);
    this.time.delayedCall(320, () => {
      this.configData.onComplete();
    });
  }
}
