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
  constructor() {
    super('TitleScene');
  }

  preload(): void {
    preloadGunungan(this);
  }

  create(): void {
    new Lighting(this);
    const floorTop = GAME.height - KELIR.floorHeight;
    this.add.rectangle(GAME.width / 2, floorTop + KELIR.floorHeight / 2, GAME.width, KELIR.floorHeight, COLORS.gedebog);

    const kayon = drawGunungan(this, GAME.width / 2, 300, 380).setDepth(10);
    gsap.to(kayon, { angle: 2, duration: 2.4, yoyo: true, repeat: -1, ease: 'sine.inOut' });

    this.add.text(GAME.width / 2, 55, 'Hanoman: Perang Wayang', textStyle(44)).setOrigin(0.5).setDepth(101);

    // ---- Arcade Story Button ----
    const arcadeBtnY = floorTop - 110;
    const btnBg = this.add
      .rectangle(GAME.width / 2, arcadeBtnY, 520, 48, 0x1c110a, 0.88)
      .setStrokeStyle(3, 0xf5c451)
      .setDepth(101)
      .setInteractive({ useHandCursor: true });

    const arcadeText = this.add
      .text(GAME.width / 2, arcadeBtnY, '⚔️   ARCADE STORY : RAMAYANA   ⚔️', {
        ...textStyle(22),
        color: '#f5c451',
      })
      .setOrigin(0.5)
      .setDepth(102);

    this.add
      .text(GAME.width / 2, arcadeBtnY + 32, '[ ENTER / KLIK ] Mulai Petualangan Cerita', {
        fontFamily: 'Georgia, serif',
        fontSize: '13px',
        color: '#f2d49b',
      })
      .setOrigin(0.5)
      .setDepth(102);

    gsap.to([btnBg, arcadeText], {
      scale: 1.03,
      duration: 0.9,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
    });

    btnBg.on('pointerover', () => {
      btnBg.setFillStyle(0x3a1f0c, 0.95);
      btnBg.setStrokeStyle(4, 0xffe082);
    });
    btnBg.on('pointerout', () => {
      btnBg.setFillStyle(0x1c110a, 0.88);
      btnBg.setStrokeStyle(3, 0xf5c451);
    });
    btnBg.on('pointerdown', () => this.start('arcade'));

    // ---- Classic Match Mode Options ----
    const menuY = floorTop - 25;
    const m1 = this.add.text(GAME.width / 2 - 270, menuY, '1   Lawan Dalang (CPU)', textStyle(18)).setOrigin(0.5).setDepth(101).setInteractive({ useHandCursor: true });
    const m2 = this.add.text(GAME.width / 2, menuY, '2   Dua Pemain (Versus)', textStyle(18)).setOrigin(0.5).setDepth(101).setInteractive({ useHandCursor: true });
    const m3 = this.add.text(GAME.width / 2 + 270, menuY, '3   🥋 Dojo Uji Coba Rig', { ...textStyle(18), color: '#ffe082' }).setOrigin(0.5).setDepth(101).setInteractive({ useHandCursor: true });

    m1.on('pointerdown', () => this.start('cpu'));
    m2.on('pointerdown', () => this.start('versus'));
    m3.on('pointerdown', () => this.start('dojo'));

    this.add
      .text(
        GAME.width / 2,
        floorTop + 40,
        'P1:  A D jalan · W lompat · J tangan · K tendang · U I O aji (Triwikrama, Ekor Api, Mengecil) · tahan mundur = tangkis\n' +
          'P2:  ← → jalan · ↑ lompat · , tangan · . tendang · L ; \' aji',
        { fontFamily: 'Georgia, serif', fontSize: '15px', color: '#f2d49b', align: 'center', lineSpacing: 4 },
      )
      .setOrigin(0.5)
      .setDepth(101);

    // Development shortcut: ?mode=arcade|cpu|versus|dojo|demo skips the title.
    const urlMode = new URLSearchParams(window.location.search).get('mode') as Mode | null;
    if (urlMode === 'arcade' || urlMode === 'cpu' || urlMode === 'versus' || urlMode === 'dojo' || urlMode === 'demo') {
      return this.start(urlMode);
    }

    const kb = this.input.keyboard!;
    kb.once('keydown-ENTER', () => this.start('arcade'));
    kb.once('keydown-SPACE', () => this.start('arcade'));
    kb.once('keydown-ONE', () => this.start('cpu'));
    kb.once('keydown-NUMPAD_ONE', () => this.start('cpu'));
    kb.once('keydown-TWO', () => this.start('versus'));
    kb.once('keydown-NUMPAD_TWO', () => this.start('versus'));
    kb.once('keydown-THREE', () => this.start('dojo'));
    kb.once('keydown-NUMPAD_THREE', () => this.start('dojo'));
    kb.once('keydown-D', () => this.start('dojo'));
  }

  private start(mode: Mode): void {
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
