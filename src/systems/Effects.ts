import Phaser from 'phaser';
import gsap from 'gsap';
import { EFFECTS } from '../constants';

const DEPTH = 50; // above the puppets, below the vignette

// Fight feedback: sparks, dust, flames and floating text.
export class Effects {
  private labels = new Map<string, Phaser.GameObjects.Text>();

  constructor(private scene: Phaser.Scene) {}

  // Gold shards bursting out, like light through tatahan.
  spark(x: number, y: number, big = false): void {
    const count = big ? EFFECTS.sparkCount * 2 : EFFECTS.sparkCount;
    const reach = big ? 90 : 55;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const shard = this.scene.add.graphics().setDepth(DEPTH).setPosition(x, y).setRotation(angle);
      shard.fillStyle(EFFECTS.sparkColor).fillTriangle(0, -3, 0, 3, 14, 0);
      const dist = reach * (0.6 + Math.random() * 0.4);
      gsap.to(shard, {
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        scaleX: 0.3,
        duration: 0.35,
        ease: 'power3.out',
        onComplete: () => shard.destroy(),
      });
    }
  }

  // A blocked blow: a short pale flash pushed back toward the attacker.
  guard(x: number, y: number, direction: number): void {
    for (let i = 0; i < 6; i++) {
      const angle = Math.PI * (direction > 0 ? 1 : 0) + (Math.random() - 0.5) * 1.6;
      const shard = this.scene.add.graphics().setDepth(DEPTH).setPosition(x, y).setRotation(angle);
      shard.fillStyle(0xfff6dc).fillRect(0, -1.5, 12, 3);
      gsap.to(shard, {
        x: x + Math.cos(angle) * 34,
        y: y + Math.sin(angle) * 34,
        alpha: 0,
        duration: 0.2,
        ease: 'power2.out',
        onComplete: () => shard.destroy(),
      });
    }
  }

  dust(x: number, y: number, amount = 1): void {
    for (const dir of [-1, 1]) {
      for (let i = 0; i < 3 * amount; i++) {
        const puff = this.scene.add.circle(x, y - 4, 6 + Math.random() * 5, EFFECTS.dustColor, 0.5).setDepth(DEPTH);
        gsap.to(puff, {
          x: x + dir * (20 + Math.random() * 40 * amount),
          y: y - 6 - Math.random() * 14,
          scale: 2,
          alpha: 0,
          duration: 0.45,
          ease: 'power2.out',
          onComplete: () => puff.destroy(),
        });
      }
    }
  }

  // One flame licking upward and fading: fireball trails.
  ember(x: number, y: number, size = 1): void {
    const colors = [0xffb347, 0xff6a1a, 0xd8341a];
    const flame = this.scene.add
      .ellipse(x, y, 12 * size, 18 * size, Phaser.Utils.Array.GetRandom(colors))
      .setDepth(DEPTH);
    gsap.to(flame, {
      y: y - 18 - Math.random() * 14,
      scaleX: 0.3,
      scaleY: 0.5,
      alpha: 0,
      duration: 0.4,
      ease: 'power1.out',
      onComplete: () => flame.destroy(),
    });
  }

  // Fireball impact: embers burst outward around a gold spark.
  burst(x: number, y: number, size = 1): void {
    this.spark(x, y, true);
    for (let i = 0; i < 14; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = (30 + Math.random() * 40) * size;
      this.ember(x + Math.cos(angle) * dist, y + Math.sin(angle) * dist * 0.7, size * 1.3);
    }
  }

  // Move name rising from where it was performed. A label with the same
  // `slot` (one per fighter) replaces the previous one, so chains stay legible.
  label(text: string, x: number, y: number, finisher = false, slot?: string): void {
    if (slot) this.labels.get(slot)?.destroy();
    const t = this.scene.add.text(x, y, text, textStyle(finisher ? 30 : 22)).setOrigin(0.5).setDepth(101);
    if (slot) this.labels.set(slot, t);
    gsap.fromTo(t, { scale: 0.6 }, { scale: 1, duration: 0.15, ease: 'back.out(3)' });
    gsap.to(t, { y: y - 40, alpha: 0, duration: 0.7, delay: 0.25, ease: 'power1.in', onComplete: () => t.destroy() });
  }

}

export function textStyle(size: number): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: 'Georgia, serif',
    fontSize: `${size}px`,
    fontStyle: 'bold',
    color: '#3a1d08',
    stroke: '#f5c451',
    strokeThickness: 4,
  };
}
