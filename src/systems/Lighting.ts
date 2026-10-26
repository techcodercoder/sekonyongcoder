import Phaser from 'phaser';
import gsap from 'gsap';
import { COLORS, GAME, KELIR } from '../constants';

const GLOW_KEY = 'blencong-glow';
const VIGNETTE_KEY = 'kelir-vignette';

// Warm blencong glow behind the puppets, plus a vignette over everything.
export class Lighting {
  private glow: Phaser.GameObjects.Image;
  private flickerTween?: gsap.core.Tween;

  constructor(private scene: Phaser.Scene) {
    this.createTextures();

    const { x, y } = KELIR.blencong;
    this.glow = scene.add.image(x, y, GLOW_KEY).setDepth(-10);
    scene.add.image(0, 0, VIGNETTE_KEY).setOrigin(0).setScrollFactor(0).setDepth(100);

    this.flicker();
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.flickerTween?.kill());
  }

  private flicker(): void {
    const b = KELIR.blencong;
    const scale = gsap.utils.random(b.scaleMin, b.scaleMax);
    this.flickerTween = gsap.to(this.glow, {
      alpha: gsap.utils.random(b.alphaMin, b.alphaMax),
      scaleX: scale,
      scaleY: scale,
      duration: gsap.utils.random(b.flickerMin, b.flickerMax),
      ease: 'sine.inOut',
      onComplete: () => this.flicker(),
    });
  }

  private createTextures(): void {
    const textures = this.scene.textures;

    if (!textures.exists(GLOW_KEY)) {
      const r = KELIR.blencong.radius;
      const canvas = textures.createCanvas(GLOW_KEY, r * 2, r * 2)!;
      const ctx = canvas.getContext();
      const g = ctx.createRadialGradient(r, r, 0, r, r, r);
      g.addColorStop(0, COLORS.blencongCore);
      g.addColorStop(0.45, COLORS.blencongMid);
      g.addColorStop(1, 'rgba(255, 170, 80, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, r * 2, r * 2);
      canvas.refresh();
    }

    if (!textures.exists(VIGNETTE_KEY)) {
      const { width: w, height: h } = GAME;
      const canvas = textures.createCanvas(VIGNETTE_KEY, w, h)!;
      const ctx = canvas.getContext();
      const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, w * 0.7);
      g.addColorStop(0, `rgba(${COLORS.kelirEdgeRgb}, 0)`);
      g.addColorStop(1, `rgba(${COLORS.kelirEdgeRgb}, ${KELIR.vignetteStrength})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      canvas.refresh();
    }
  }
}
