import Phaser from 'phaser';
import gsap from 'gsap';
import QRCode from 'qrcode';
import { GAME } from '../constants';
import storyConfig from '../data/story-config.json';

export interface PrambananPromoData {
  enabled?: boolean;
  badge?: string;
  headline?: string;
  bodyText?: string;
  ctaText?: string;
  qrUrl?: string;
}

export class PrambananScene extends Phaser.Scene {
  private promoData!: PrambananPromoData;

  constructor() {
    super('PrambananScene');
  }

  init(data: PrambananPromoData): void {
    const configPromo = (storyConfig as any).prambananPromo || {};
    this.promoData = {
      enabled: data.enabled ?? configPromo.enabled ?? true,
      badge: data.badge ?? configPromo.badge ?? 'SENDRATARI RAMAYANA PRAMBANAN',
      headline:
        data.headline ??
        configPromo.headline ??
        'Kamu Sudah Memainkannya.\nSekarang, Duduklah dan Saksikan Mereka Menari.',
      bodyText:
        data.bodyText ??
        configPromo.bodyText ??
        'Menggerakkan Hanoman melompati kelir layar hanyalah permulaan.\n\nDi pelataran Candi Prambanan, kisah ini dipentaskan tanpa sepatah kata pun—hanya tatapan mata ksatria, ayunan pedang raksasa, dan gemuruh kendang yang mengunci ratusan pasang mata penonton dunia sejak 1961.\n\nHadir dan jadilah saksi langsung epik terbesar tanah Jawa di panggung terbuka termegah nusantara.',
      ctaText:
        data.ctaText ??
        configPromo.ctaText ??
        'Pindai untuk reservasi kursi pertunjukan via injourneydestination.id',
      qrUrl: data.qrUrl ?? configPromo.qrUrl ?? 'https://injourneydestination.id/',
    };
  }

  create(): void {
    const { width, height } = GAME;

    // 1. Theatrical Dark Backdrop
    this.add.rectangle(width / 2, height / 2, width, height, 0x0c0704).setDepth(0);

    // Decorative subtle ambient glow in center
    const ambientGlow = this.add.graphics().setDepth(1);
    ambientGlow.fillStyle(0x3a1f0c, 0.45);
    ambientGlow.fillCircle(width / 2, height / 2, 420);

    // Outer ornate gold frame
    const border = this.add.graphics().setDepth(2);
    border.lineStyle(2, 0xd4af37, 0.65);
    border.strokeRect(24, 24, width - 48, height - 48);
    border.lineStyle(1, 0x8a5a2b, 0.4);
    border.strokeRect(30, 30, width - 60, height - 60);

    // Corner decorative accents
    this.drawCornerAccents(border, 24, 24, width - 48, height - 48);

    // ----------------------------------------------------
    // LEFT COLUMN: Copywriting & Cultural Invitation
    // ----------------------------------------------------
    const leftX = 70;
    let currentY = 65;

    // Cultural Badge Pill
    const badgeText = this.add
      .text(leftX + 16, currentY + 6, `🏛️  ${this.promoData.badge}`, {
        fontFamily: 'Georgia, serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#f5c451',
      })
      .setDepth(10);

    const badgeWidth = badgeText.width + 32;
    this.add
      .rectangle(leftX + badgeWidth / 2, currentY + 14, badgeWidth, 28, 0x24150b, 0.9)
      .setStrokeStyle(1.5, 0xd4af37, 0.8)
      .setDepth(9);

    currentY += 50;

    // Headline
    const headline = this.add
      .text(leftX, currentY, this.promoData.headline!, {
        fontFamily: 'Georgia, serif',
        fontSize: '29px',
        fontStyle: 'bold',
        color: '#fff3d1',
        lineSpacing: 8,
        stroke: '#1a0e06',
        strokeThickness: 3,
        wordWrap: { width: 590 },
      })
      .setDepth(10);

    currentY += headline.height + 20;

    // Gold decorative divider
    const divider = this.add.graphics().setDepth(10);
    divider.lineStyle(2, 0xd4af37, 0.7);
    divider.lineBetween(leftX, currentY, leftX + 570, currentY);
    divider.fillStyle(0xf5c451, 1);
    divider.fillTriangle(leftX + 285, currentY - 5, leftX + 291, currentY, leftX + 285, currentY + 5);
    divider.fillTriangle(leftX + 285, currentY - 5, leftX + 279, currentY, leftX + 285, currentY + 5);

    currentY += 22;

    // Body text (anti-AI slop, evocative cultural storytelling)
    this.add
      .text(leftX, currentY, this.promoData.bodyText!, {
        fontFamily: 'Georgia, serif',
        fontSize: '16.5px',
        color: '#f0dfbe',
        lineSpacing: 8,
        wordWrap: { width: 580 },
      })
      .setDepth(10);

    // ----------------------------------------------------
    // RIGHT COLUMN: QR Code Card & Direct InJourney Link
    // ----------------------------------------------------
    const cardX = 970;
    const cardY = 325;
    const cardW = 410;
    const cardH = 475;

    // Card background
    this.add
      .rectangle(cardX, cardY, cardW, cardH, 0x180f08, 0.94)
      .setStrokeStyle(2, 0xd4af37, 0.85)
      .setDepth(9);

    // Inner subtle card border
    this.add
      .rectangle(cardX, cardY, cardW - 12, cardH - 12, 0x000000, 0)
      .setStrokeStyle(1, 0x8a5a2b, 0.5)
      .setDepth(9);

    // Card Title
    this.add
      .text(cardX, cardY - 195, 'PANGGUNG TERBUKA PRAMBANAN', {
        fontFamily: 'Georgia, serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#f5c451',
      })
      .setOrigin(0.5)
      .setDepth(10);

    this.add
      .text(cardX, cardY - 173, 'Jadwal Pentas & Tiket Masuk Resmi', {
        fontFamily: 'Georgia, serif',
        fontSize: '12px',
        color: '#d6c29b',
      })
      .setOrigin(0.5)
      .setDepth(10);

    // QR Code Canvas texture (rendered dynamically from this.promoData.qrUrl)
    this.renderQrCode(cardX, cardY - 40, 210);

    // CTA Text below QR
    this.add
      .text(cardX, cardY + 98, this.promoData.ctaText!, {
        fontFamily: 'Georgia, serif',
        fontSize: '13px',
        color: '#fff1d0',
        align: 'center',
        wordWrap: { width: 360 },
      })
      .setOrigin(0.5)
      .setDepth(10);

    // Clickable Direct Link Button
    const btnY = cardY + 165;
    const linkBtn = this.add
      .rectangle(cardX, btnY, 340, 42, 0x3d210e, 0.95)
      .setStrokeStyle(2, 0xf5c451, 1)
      .setDepth(10)
      .setInteractive({ useHandCursor: true });

    const linkText = this.add
      .text(cardX, btnY, '🌐 Buka injourneydestination.id ↗', {
        fontFamily: 'Georgia, serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#fce29d',
      })
      .setOrigin(0.5)
      .setDepth(11);

    linkBtn.on('pointerover', () => {
      linkBtn.setFillStyle(0x5a3116, 1);
      linkBtn.setStrokeStyle(2.5, 0xffe27a, 1);
      linkText.setColor('#ffffff');
    });

    linkBtn.on('pointerout', () => {
      linkBtn.setFillStyle(0x3d210e, 0.95);
      linkBtn.setStrokeStyle(2, 0xf5c451, 1);
      linkText.setColor('#fce29d');
    });

    linkBtn.on('pointerdown', () => {
      if (this.promoData.qrUrl) {
        window.open(this.promoData.qrUrl, '_blank');
      }
    });

    // ----------------------------------------------------
    // BOTTOM BAR: Return to Title Screen Prompt
    // ----------------------------------------------------
    const returnY = height - 48;
    const returnBtn = this.add
      .rectangle(width / 2, returnY, 520, 36, 0x1f120a, 0.85)
      .setStrokeStyle(1.5, 0xd4af37, 0.7)
      .setDepth(10)
      .setInteractive({ useHandCursor: true });

    const returnText = this.add
      .text(width / 2, returnY, 'TEKAN [ ❌ / START ] PADA JOYSTICK UNTUK KEMBALI KE MENU UTAMA', {
        fontFamily: 'Georgia, serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#f5c451',
      })
      .setOrigin(0.5)
      .setDepth(11);

    gsap.to([returnBtn, returnText], {
      scale: 1.02,
      duration: 1.1,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
    });

    const exitToTitle = () => {
      this.sound.stopAll();
      this.scene.start('TitleScene');
    };

    returnBtn.on('pointerdown', exitToTitle);
    this.input.keyboard?.once('keydown-SPACE', exitToTitle);
    this.input.keyboard?.once('keydown-ENTER', exitToTitle);
    this.input.keyboard?.once('keydown-ESC', exitToTitle);

    if (this.input.gamepad) {
      const pad = this.input.gamepad.getPad(0);
      if (pad) pad.once('down', exitToTitle);
      this.input.gamepad.once('connected', (newPad: Phaser.Input.Gamepad.Gamepad) => {
        newPad.once('down', exitToTitle);
      });
    }
  }

  private async renderQrCode(x: number, y: number, size: number): Promise<void> {
    const textureKey = 'prambanan_qr_canvas';

    // Outer white paper wrapper with gentle gold border
    this.add
      .rectangle(x, y, size + 20, size + 20, 0xfffcf5, 1)
      .setStrokeStyle(2, 0xd4af37, 0.9)
      .setDepth(10);

    // Reuse or create canvas texture
    if (this.textures.exists(textureKey)) {
      this.textures.remove(textureKey);
    }

    const canvasTexture = this.textures.createCanvas(textureKey, size, size);
    if (!canvasTexture) return;

    const canvas = canvasTexture.getSourceImage() as HTMLCanvasElement;
    const url = this.promoData.qrUrl || 'https://injourneydestination.id/';

    try {
      await QRCode.toCanvas(canvas, url, {
        width: size,
        margin: 1,
        color: {
          dark: '#1c110a',
          light: '#fffcf5',
        },
      });
      canvasTexture.refresh();
      this.add.image(x, y, textureKey).setDepth(11);
    } catch (err) {
      console.error('Failed to generate Prambanan QR Code:', err);
    }
  }

  private drawCornerAccents(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    const s = 14;
    graphics.lineStyle(3, 0xf5c451, 0.9);

    // Top Left
    graphics.lineBetween(x, y, x + s, y);
    graphics.lineBetween(x, y, x, y + s);

    // Top Right
    graphics.lineBetween(x + w, y, x + w - s, y);
    graphics.lineBetween(x + w, y, x + w, y + s);

    // Bottom Left
    graphics.lineBetween(x, y + h, x + s, y + h);
    graphics.lineBetween(x, y + h, x, y + h - s);

    // Bottom Right
    graphics.lineBetween(x + w, y + h, x + w - s, y + h);
    graphics.lineBetween(x + w, y + h, x + w, y + h - s);
  }
}
