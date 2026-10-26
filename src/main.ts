import Phaser from 'phaser';
import gsap from 'gsap';
import { GAME, COLORS } from './constants';
import { FightScene } from './scenes/FightScene';
import { TitleScene } from './scenes/TitleScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME.width,
  height: GAME.height,
  backgroundColor: COLORS.kelir,
  // Character art is drawn large and shown small; mipmaps keep it from aliasing.
  render: { mipmapFilter: 'LINEAR_MIPMAP_LINEAR' },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [TitleScene, FightScene],
});

// Dev only: lets tooling inspect the running game from the browser console.
if (import.meta.env.DEV) Object.assign(window, { game, gsap });
