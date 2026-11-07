import Phaser from 'phaser';
import gsap from 'gsap';
import { COLORS, GAME, KELIR } from '../constants';
import { textStyle } from '../systems/Effects';
import { drawGunungan, preloadGunungan } from '../systems/Gunungan';
import { Lighting } from '../systems/Lighting';
import storyConfig from '../data/story-config.json';

// 'demo' (CPU against CPU) is only reachable with ?mode=demo, for watching the AI.
export type Mode = 'arcade' | 'cpu' | 'versus' | 'dojo' | 'demo';

// Title: the gunungan stands in the middle of the kelir, as before a show.
export class TitleScene extends Phaser.Scene {
  private starting = false;
  constructor() {
    super('TitleScene');
  }

  preload(): void {
    preloadGunungan(this);
  }

  create(): void {
    this.starting = false;
    new Lighting(this);
    const floorTop = GAME.height - KELIR.floorHeight;
    this.add.rectangle(GAME.width / 2, floorTop + KELIR.floorHeight / 2, GAME.width, KELIR.floorHeight, COLORS.gedebog);

    const kayon = drawGunungan(this, GAME.width / 2, 300, 380).setDepth(10);
    gsap.to(kayon, { angle: 2, duration: 2.4, yoyo: true, repeat: -1, ease: 'sine.inOut' });

    this.add.text(GAME.width / 2, 55, 'Game Wayang Kulit Ramayana', textStyle(44)).setOrigin(0.5).setDepth(101);

    // ---- Arcade Story Button ----
    const arcadeBtnY = floorTop - 115;
    const btnBg = this.add
      .rectangle(GAME.width / 2, arcadeBtnY, 580, 74, 0x1c110a, 0.94)
      .setStrokeStyle(3, 0xf5c451)
      .setDepth(101)
      .setInteractive({ useHandCursor: true });

    const arcadeText = this.add
      .text(GAME.width / 2, arcadeBtnY - 14, '⚔️   ARCADE STORY : RAMAYANA   ⚔️', {
        ...textStyle(21),
        color: '#f5c451',
      })
      .setOrigin(0.5)
      .setDepth(102);

    const arcadeSubText = this.add
      .text(GAME.width / 2, arcadeBtnY + 16, '🎮 [ TEKAN TOMBOL ⬜ / KLIK ] Mulai Petualangan Cerita', {
        fontFamily: 'Georgia, serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#fff3d1',
        stroke: '#1c110a',
        strokeThickness: 2.5,
      })
      .setOrigin(0.5)
      .setDepth(102);

    gsap.to([btnBg, arcadeText, arcadeSubText], {
      scale: 1.03,
      duration: 0.9,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
    });

    btnBg.on('pointerover', () => {
      btnBg.setFillStyle(0x3a1f0c, 0.98);
      btnBg.setStrokeStyle(4, 0xffe082);
      arcadeSubText.setColor('#ffffff');
    });
    btnBg.on('pointerout', () => {
      btnBg.setFillStyle(0x1c110a, 0.94);
      btnBg.setStrokeStyle(3, 0xf5c451);
      arcadeSubText.setColor('#fff3d1');
    });
    btnBg.on('pointerdown', () => this.start('arcade'));

    // ---- Classic Match Mode Options ----
    const menuY = floorTop - 25;
    const m1 = this.add.text(GAME.width / 2 - 270, menuY, '[❌] Lawan Dalang CPU', textStyle(18)).setOrigin(0.5).setDepth(101).setInteractive({ useHandCursor: true });
    const m2 = this.add.text(GAME.width / 2, menuY, '[🔺] Dua Pemain (Versus)', textStyle(18)).setOrigin(0.5).setDepth(101).setInteractive({ useHandCursor: true });
    const m3 = this.add.text(GAME.width / 2 + 270, menuY, '[LB] 🥋 Dojo Uji Coba Rig', { ...textStyle(18), color: '#ffe082' }).setOrigin(0.5).setDepth(101).setInteractive({ useHandCursor: true });

    m1.on('pointerdown', () => this.start('cpu'));
    m2.on('pointerdown', () => this.start('versus'));
    m3.on('pointerdown', () => this.start('dojo'));

    this.add
      .text(
        GAME.width / 2,
        floorTop + 40,
        '🎮 KONTROL JOYSTICK: Analog / D-Pad Jalan · ❌ / D-Pad Atas Lompat · ⬜ Pukul · ⭕ Tendang\n' +
          '🔺 Triwikrama · RB/R1 Ekor Api · LB/L1 Mengecil · Tahan Mundur = Tangkis',
        { fontFamily: 'Georgia, serif', fontSize: '15px', color: '#f2d49b', align: 'center', lineSpacing: 4 },
      )
      .setOrigin(0.5)
      .setDepth(101);

    // Development shortcut: ?mode=arcade|cpu|versus|dojo|demo skips the title.
    const urlMode = new URLSearchParams(window.location.search).get('mode') as Mode | null;
    if (urlMode === 'arcade' || urlMode === 'cpu' || urlMode === 'versus' || urlMode === 'dojo' || urlMode === 'demo') {
      return this.start(urlMode);
    }

    // Keyboard input completely deprecated. Exclusively gamepad-driven.

    // Gamepad status indicator
    const padStatusText = this.add
      .text(GAME.width / 2, 22, '', {
        fontFamily: 'Georgia, serif',
        fontSize: '12px',
        color: '#f5c451',
        stroke: '#1c110a',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(150);

    const updatePadStatus = (lastBtn?: number) => {
      const nativePads = typeof navigator.getGamepads === 'function' ? Array.from(navigator.getGamepads()).filter(Boolean) : [];
      const pad = nativePads[0] || this.input.gamepad?.getPad(0);
      if (pad && pad.connected) {
        const padName = (pad.id || 'Joystick').split('(')[0].trim().slice(0, 24);
        if (lastBtn !== undefined) {
          padStatusText.setText(`🎮 ${padName} | Tombol [${lastBtn}] Ditekan`);
          padStatusText.setColor('#ffe082');
        } else {
          padStatusText.setText(`🎮 ${padName} TERHUBUNG (Siap Bertanding)`);
          padStatusText.setColor('#81c784');
        }
      } else {
        padStatusText.setText('🎮 Menunggu Joystick: Sambungkan joystick & tekan sembarang tombol');
        padStatusText.setColor('#ffe082');
      }
    };
    updatePadStatus();
    this.input.gamepad?.on('connected', () => updatePadStatus());
    this.input.gamepad?.on('disconnected', () => updatePadStatus());

    const isDirectInput = (padObj?: any): boolean => {
      const id = (padObj?.id || '').toLowerCase();
      const mapping = padObj?.mapping;
      return (mapping !== 'standard') && (
        id.includes('054c') ||
        id.includes('wireless controller') ||
        id.includes('dualshock') ||
        id.includes('dualsense') ||
        id.includes('sony') ||
        id.includes('playstation') ||
        id.includes('usb gamepad') ||
        id.includes('twin') ||
        id.includes('generic')
      );
    };

    const bindTitleGamepad = (pad: Phaser.Input.Gamepad.Gamepad) => {
      const dinput = isDirectInput(pad);
      pad.on('down', (btn: number) => {
        // 🔺 (Triangle / Segitiga: btn 3), Start (btn 9), or ❌ (Cross: btn 1 on DInput, 0 on XInput) -> Arcade
        if (btn === 3 || btn === 9 || (dinput ? btn === 1 : btn === 0)) {
          this.start('arcade');
        }
        // ⭕ (Circle: btn 2 on DInput, 1 on XInput) -> CPU
        else if (dinput ? btn === 2 : btn === 1) {
          this.start('cpu');
        }
        // ⬜ (Square / Kotak: btn 0 on DInput, 2 on XInput) -> Versus
        else if (dinput ? btn === 0 : btn === 2) {
          this.start('versus');
        }
        // [LB] / [L1] (btn 4) -> Dojo
        else if (btn === 4) {
          this.start('dojo');
        }
      });
    };

    if (this.input.gamepad) {
      const current = this.input.gamepad.getPad(0);
      if (current) bindTitleGamepad(current);
      this.input.gamepad.on('connected', (pad: Phaser.Input.Gamepad.Gamepad) => {
        bindTitleGamepad(pad);
      });
    }
  }

  update(): void {
    if (this.starting) return;

    // 1. Native HTML5 Gamepad polling (direct from browser, reliable regardless of Phaser state)
    const nativePads = typeof navigator.getGamepads === 'function' ? Array.from(navigator.getGamepads()) : [];
    for (const pad of nativePads) {
      if (!pad || !pad.connected) continue;

      const dinput = (pad.mapping !== 'standard') && (
        pad.id.toLowerCase().includes('054c') ||
        pad.id.toLowerCase().includes('wireless controller') ||
        pad.id.toLowerCase().includes('dualshock') ||
        pad.id.toLowerCase().includes('dualsense') ||
        pad.id.toLowerCase().includes('sony') ||
        pad.id.toLowerCase().includes('playstation') ||
        pad.id.toLowerCase().includes('usb gamepad') ||
        pad.id.toLowerCase().includes('twin') ||
        pad.id.toLowerCase().includes('generic')
      );

      const btnDown = (idx: number) => Boolean(pad.buttons[idx]?.pressed || (pad.buttons[idx]?.value ?? 0) > 0.5);

      // Button 3 (🔺 / Triangle), Button 9 (Start), or Cross -> Arcade
      if (btnDown(3) || btnDown(9) || (dinput ? btnDown(1) : btnDown(0))) {
        this.start('arcade');
        return;
      }
      // Circle -> CPU (2 on DInput, 1 on XInput)
      if (dinput ? btnDown(2) : btnDown(1)) {
        this.start('cpu');
        return;
      }
      // Square -> Versus (0 on DInput, 2 on XInput)
      if (dinput ? btnDown(0) : btnDown(2)) {
        this.start('versus');
        return;
      }
      // Button 4 (LB / L1) -> Dojo
      if (btnDown(4)) {
        this.start('dojo');
        return;
      }
    }

    // 2. Phaser Gamepad fallback
    const phaserPad = this.input.gamepad?.getPad(0);
    if (phaserPad && phaserPad.connected) {
      const isArcade = Boolean(
        phaserPad.Y ||
        (phaserPad.buttons[3] && phaserPad.buttons[3].pressed) ||
        phaserPad.A ||
        (phaserPad.buttons[0] && phaserPad.buttons[0].pressed) ||
        (phaserPad.buttons[9] && phaserPad.buttons[9].pressed)
      );
      if (isArcade) {
        this.start('arcade');
        return;
      }
      if (phaserPad.B || (phaserPad.buttons[1] && phaserPad.buttons[1].pressed)) {
        this.start('cpu');
        return;
      }
      if (phaserPad.X || (phaserPad.buttons[2] && phaserPad.buttons[2].pressed)) {
        this.start('versus');
        return;
      }
      if (phaserPad.L1 || (phaserPad.buttons[4] && phaserPad.buttons[4].pressed)) {
        this.start('dojo');
        return;
      }
    }
  }

  private start(mode: Mode): void {
    if (this.starting) return;
    this.starting = true;
    const snd = this.sound as any;
    if (snd && snd.context && snd.context.state === 'suspended') {
      snd.context.resume().catch(() => {});
    }
    if (mode === 'dojo') {
      this.scene.start('DojoScene');
      return;
    }

    if (mode === 'arcade' && storyConfig?.chapters?.length > 0) {
      const ch1 = storyConfig.chapters[0];
      this.scene.start('CinematicScene', {
        badge: '🎬 PROLOG BABAK 1',
        title: ch1.title,
        subtitle: ch1.subtitle,
        videoUrl: ch1.introVideo,
        durationSeconds: 6,
        onComplete: () => {
          this.scene.start('FightScene', {
            mode: 'arcade',
            wins: [0, 0],
            round: 1,
            chapterIndex: 1,
            player1Char: ch1.player1,
            cpuChar: ch1.cpu,
          });
        },
      });
      return;
    }
    this.scene.start('FightScene', { mode, wins: [0, 0], round: 1 });
  }
}
