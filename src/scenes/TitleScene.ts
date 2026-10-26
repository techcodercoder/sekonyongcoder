import Phaser from 'phaser';
import gsap from 'gsap';
import { COLORS, GAME, KELIR } from '../constants';
import { textStyle } from '../systems/Effects';
import { drawGunungan, preloadGunungan } from '../systems/Gunungan';
import { Lighting } from '../systems/Lighting';

// 'demo' (CPU against CPU) is only reachable with ?mode=demo, for watching the AI.
export type Mode = 'cpu' | 'versus' | 'demo';

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

    const kayon = drawGunungan(this, GAME.width / 2, 330, 420).setDepth(10);
    gsap.to(kayon, { angle: 2, duration: 2.4, yoyo: true, repeat: -1, ease: 'sine.inOut' });

    this.add.text(GAME.width / 2, 70, 'Hanoman: Perang Wayang', textStyle(48)).setOrigin(0.5).setDepth(101);
    const menu = this.add
      .text(GAME.width / 2, floorTop - 60, '1   Lawan Dalang (CPU)          2   Dua Pemain', textStyle(26))
      .setOrigin(0.5)
      .setDepth(101);
    gsap.to(menu, { alpha: 0.55, duration: 0.8, yoyo: true, repeat: -1 });

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

    // Development shortcut: ?mode=cpu|versus|demo skips the title.
    const urlMode = new URLSearchParams(window.location.search).get('mode') as Mode | null;
    if (urlMode === 'cpu' || urlMode === 'versus' || urlMode === 'demo') return this.start(urlMode);

    const kb = this.input.keyboard!;
    kb.once('keydown-ONE', () => this.start('cpu'));
    kb.once('keydown-TWO', () => this.start('versus'));
  }

  private start(mode: Mode): void {
    this.scene.start('FightScene', { mode, wins: [0, 0], round: 1 });
  }
}
