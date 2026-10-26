import Phaser from 'phaser';
import gsap from 'gsap';
import { COLORS } from '../constants';

const KEY = 'gunungan';

// The artwork is optional: a glob matches nothing until the file exists.
const artwork = Object.values(
  import.meta.glob<string>('../assets/gunungan.png', { eager: true, query: '?url', import: 'default' }),
)[0];

export function preloadGunungan(scene: Phaser.Scene): void {
  if (artwork && !scene.textures.exists(KEY)) scene.load.image(KEY, artwork);
}

// The gunungan (kayon): the leaf-shaped puppet a dalang plants in the middle
// of the kelir to open and close scenes. Uses src/assets/gunungan.png when
// present, otherwise a drawn placeholder.
export function drawGunungan(scene: Phaser.Scene, x: number, y: number, height = 460): Phaser.GameObjects.Container {
  if (scene.textures.exists(KEY)) {
    const img = scene.add.image(0, 0, KEY);
    img.setScale(height / img.height);
    return scene.add.container(x, y, [img]).setDepth(90);
  }

  const h = height;
  const w = h * 0.55;
  const g = scene.add.graphics();

  // Outline: pointed top, widest low down, then a broad flat bottom edge.
  const outline = (inset: number) => {
    const pts: Phaser.Math.Vector2[] = [];
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps; // 0 at the tip, 1 at the bottom of the leaf
      const yy = -h / 2 + t * h * 0.82;
      const s = Math.pow(t, 2.1);
      const half = (w / 2) * (s < 0.5 ? Math.sin(Math.PI * s) : 1 - (s - 0.5) * 0.5) - inset;
      pts.push(new Phaser.Math.Vector2(Math.max(0, half), yy + inset * 0.6));
    }
    return [...pts.map((p) => new Phaser.Math.Vector2(-p.x, p.y)), ...pts.reverse()];
  };

  g.fillStyle(COLORS.silhouette).fillPoints(outline(0), true);
  g.fillStyle(0x6b2a14).fillPoints(outline(10), true);

  // Tree of life: trunk with paired branches.
  g.lineStyle(4, COLORS.gold);
  const trunkTop = -h / 2 + 50;
  const trunkBottom = h * 0.28;
  g.lineBetween(0, trunkTop, 0, trunkBottom);
  for (let i = 0; i < 6; i++) {
    const by = trunkTop + 30 + i * ((trunkBottom - trunkTop - 40) / 6);
    const reach = w * 0.12 + i * w * 0.045;
    g.lineBetween(0, by, -reach, by - 22);
    g.lineBetween(0, by, reach, by - 22);
  }

  // Tatahan: rows of light holes along the edge.
  g.fillStyle(COLORS.gold);
  outline(22).forEach((p, i) => {
    if (i % 3 === 0) g.fillCircle(p.x, p.y, 2.5);
  });

  // Stepped base (the palace gate at the foot of the kayon).
  const baseY = -h / 2 + h * 0.82;
  g.fillStyle(COLORS.silhouette).fillRect(-w * 0.28, baseY, w * 0.56, h * 0.08);
  g.fillRect(-w * 0.18, baseY + h * 0.08, w * 0.36, h * 0.1);
  g.fillStyle(COLORS.gold).fillRect(-w * 0.06, baseY + h * 0.02, w * 0.12, h * 0.12);

  return scene.add.container(x, y, [g]).setDepth(90);
}

// Round opening: the gunungan rises into the centre, holds, then the dalang
// sweeps it up and away. `onClear` fires as it leaves.
export function gununganTransition(scene: Phaser.Scene, onClear: () => void): void {
  const { width, height } = scene.scale;
  const kayon = drawGunungan(scene, width / 2, height + 300);
  gsap
    .timeline({ onComplete: () => kayon.destroy() })
    .to(kayon, { y: height / 2 - 20, duration: 0.45, ease: 'power3.out' })
    .to(kayon, { angle: -4, duration: 0.15, yoyo: true, repeat: 1, ease: 'sine.inOut' })
    .call(onClear, [], '+=0.2')
    .to(kayon, { y: -360, angle: 25, x: width / 2 + 220, duration: 0.5, ease: 'power2.in' }, '<');
}
