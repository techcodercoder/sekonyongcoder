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
  private hasActiveVideo = false;
    private videoEl?: HTMLVideoElement;
  private progressBar!: Phaser.GameObjects.Rectangle;
  private loadingText?: Phaser.GameObjects.Text;
  private audioPrompt?: Phaser.GameObjects.Text;

  constructor() {
    super('CinematicScene');
  }

  preload(): void {
    preloadGunungan(this);
  }

  create(data: CinematicData): void {
    this.configData = data;
    this.isFinishing = false;
    this.hasActiveVideo = Boolean(data.videoUrl);
    
    // 1. Deep theatrical dark backdrop (covers fighters & fight UI underneath)
    const backdrop = this.add
      .rectangle(GAME.width / 2, GAME.height / 2, GAME.width, GAME.height, 0x060402, 0)
      .setDepth(1);
    gsap.to(backdrop, { fillAlpha: 0.94, duration: 0.35, ease: 'power2.out' });

    // 2. Warm kelir lighting & stage floor
    new Lighting(this);
    const floorTop = GAME.height - KELIR.floorHeight;
    this.add
      .rectangle(GAME.width / 2, floorTop + KELIR.floorHeight / 2, GAME.width, KELIR.floorHeight, COLORS.gedebog, 0.9)
      .setDepth(2);

    // 3. Golden center aura behind Gunungan
    const aura = this.add.circle(GAME.width / 2, 320, 160, 0xf5c451, 0.08).setDepth(3);
    gsap.to(aura, { scale: 1.3, alpha: 0.16, duration: 1.8, yoyo: true, repeat: -1, ease: 'sine.inOut' });

    // 4. Center Kayon / Gunungan
    const kayon = drawGunungan(this, GAME.width / 2, 325, 330).setDepth(10);
    gsap.to(kayon, { angle: 3, duration: 2.2, yoyo: true, repeat: -1, ease: 'sine.inOut' });

    // 5. Header Badge with decorative dark pill container
    const badgeText = data.badge ?? 'LAKON RAMAYANA';
    this.add
      .rectangle(GAME.width / 2, 65, 380, 32, 0x1f1107, 0.95)
      .setStrokeStyle(1.5, 0xf5c451, 0.85)
      .setDepth(20);

    this.add
      .text(GAME.width / 2, 65, badgeText, {
        fontFamily: 'Georgia, serif',
        fontSize: '15px',
        color: '#f5c451',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(21);

    // 6. Title with strong drop-shadow and outline
    this.add
      .text(GAME.width / 2, 115, data.title, {
        ...textStyle(32),
        stroke: '#120803',
        strokeThickness: 5,
        shadow: { offsetX: 2, offsetY: 2, color: '#000000', blur: 6, fill: true },
      })
      .setOrigin(0.5)
      .setDepth(21);

    // 7. Subtitle with clear contrasting serif font
    this.add
      .text(GAME.width / 2, 155, data.subtitle, {
        fontFamily: 'Georgia, serif',
        fontSize: '18px',
        color: '#fce3b6',
        fontStyle: 'italic',
        stroke: '#120803',
        strokeThickness: 3,
        shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 4, fill: true },
      })
      .setOrigin(0.5)
      .setDepth(21);

    // 8. Progress Bar (placed below Gunungan, grounded & clean)
    const duration = data.durationSeconds ?? (data.badge?.includes('RAGE') ? 10 : 8);
    const barY = 505;
    this.add
      .rectangle(GAME.width / 2, barY, 404, 10, 0x140b04, 0.9)
      .setStrokeStyle(1, 0x8a6a2a, 0.7)
      .setDepth(20);

    this.progressBar = this.add
      .rectangle(GAME.width / 2 - 200, barY, 0, 6, 0xf5c451)
      .setOrigin(0, 0.5)
      .setDepth(21);

    // 9. Informational Badge (No-Skip Rule: Cutscene/Rage must be watched to completion)
    this.add
      .rectangle(GAME.width / 2, GAME.height - 35, 360, 32, 0x180d05, 0.85)
      .setStrokeStyle(1.2, 0x8a6a2a, 0.7)
      .setDepth(22);

    this.add
      .text(GAME.width / 2, GAME.height - 35, '🎬 Saksikan Kisah Sampai Selesai', {
        fontFamily: 'Georgia, serif',
        fontSize: '13px',
        color: '#f5c451',
      })
      .setOrigin(0.5)
      .setDepth(23);

    // 10. Video Playback handling vs Non-Video Card
    if (data.videoUrl) {
      this.tryPlayVideo(data.videoUrl);
    } else {
      gsap.to(this.progressBar, {
        width: 400,
        duration,
        ease: 'linear',
        onComplete: () => this.finish(),
      });
    }
  }

  private tryPlayVideo(url: string): void {
    try {
      this.loadingText = this.add
        .text(GAME.width / 2, 340, '⏳ Memuat Adegan Film Cerita Wayang...', {
          fontFamily: 'Georgia, serif',
          fontSize: '16px',
          color: '#f5c451',
          stroke: '#1c110a',
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(25);

      const vid = document.createElement('video');
      vid.src = url;
      vid.autoplay = true;
      vid.muted = false;
      vid.playsInline = true;
      vid.preload = 'auto';

      vid.style.position = 'fixed';
      vid.style.top = '50%';
      vid.style.left = '50%';
      vid.style.transform = 'translate(-50%, -50%)';
      vid.style.width = '78vw';
      vid.style.maxWidth = '980px';
      vid.style.height = '66vh';
      vid.style.maxHeight = '540px';
      vid.style.objectFit = 'contain';
      vid.style.backgroundColor = '#000000';
      vid.style.zIndex = '99999';
      vid.style.borderRadius = '12px';
      vid.style.border = '3px solid #f5c451';
      vid.style.boxShadow = '0 0 45px rgba(245, 196, 81, 0.8)';

      vid.onplaying = () => {
                if (this.loadingText) {
          this.loadingText.destroy();
          this.loadingText = undefined;
        }
      };

      vid.ontimeupdate = () => {
        if (vid.duration && this.progressBar && this.progressBar.active) {
          const progress = Math.min(1, vid.currentTime / vid.duration);
          this.progressBar.width = progress * 400;
        }
      };

      vid.onended = () => {
                this.finish();
      };

      vid.onerror = () => {
        console.warn('Video failed to load, finishing fallback:', url);
        this.hasActiveVideo = false;
        if (this.videoEl) {
          this.videoEl.remove();
          this.videoEl = undefined;
        }
        this.finish();
      };

      document.body.appendChild(vid);
      this.videoEl = vid;

      const playPromise = vid.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('Unmuted autoplay blocked by browser policy, switching to muted:', err);
          vid.muted = true;
          vid.play().catch((err2) => {
            console.error('Video play totally failed:', err2);
            this.hasActiveVideo = false;
            this.finish();
          });
          this.showAudioNotice();
        });
      }
    } catch (e) {
      console.error('tryPlayVideo exception:', e);
      this.hasActiveVideo = false;
      this.finish();
    }
  }

  private showAudioNotice(): void {
    if (this.audioPrompt) return;
    this.audioPrompt = this.add
      .text(GAME.width / 2, 475, '🔊 Klik layar atau tekan sembarang tombol untuk mengaktifkan suara', {
        fontFamily: 'Georgia, serif',
        fontSize: '13px',
        color: '#fff3d1',
        stroke: '#1c110a',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(30);

    const unmute = () => {
      if (this.videoEl) this.videoEl.muted = false;
      if (this.audioPrompt) {
        this.audioPrompt.destroy();
        this.audioPrompt = undefined;
      }
      window.removeEventListener('click', unmute);
      window.removeEventListener('keydown', unmute);
    };

    window.addEventListener('click', unmute, { once: true });
    window.addEventListener('keydown', unmute, { once: true });
  }

  private finish(): void {
    if (this.hasActiveVideo) {
      this.hasActiveVideo = false;
    }
    if (this.isFinishing) return;
    this.isFinishing = true;

    if (this.videoEl) {
      this.videoEl.pause();
      this.videoEl.remove();
      this.videoEl = undefined;
    }

    if (this.loadingText) {
      this.loadingText.destroy();
      this.loadingText = undefined;
    }

    if (this.audioPrompt) {
      this.audioPrompt.destroy();
      this.audioPrompt = undefined;
    }

    gsap.killTweensOf(this);
    this.cameras.main.fade(300, 10, 6, 3);
    this.time.delayedCall(320, () => {
      this.configData.onComplete();
    });
  }
}
