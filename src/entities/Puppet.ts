import Phaser from 'phaser';

// Rig data written by scripts/build-rig.py. Points are in the parts sheet's
// pixels: each bone's pivot (on its own piece) is pinned to `at` (on its
// parent's piece). `rest` is the limb's drawn angle; the piece is counter-
// rotated by it so joint angle 0 hangs straight down, as in the placeholder.
export interface RigData {
  pieces: Record<string, { file: string; x: number; y: number; w: number; h: number }>;
  bones: {
    name: string;
    piece: string;
    parent: string | null;
    pivot: [number, number];
    at: [number, number] | null;
    rest: number;
    angle: number;
    tuding?: [number, number];
  }[];
  drawOrder: string[];
  // Named spots in a joint's local frame (e.g. the tail tip).
  points?: Record<string, { bone: string; x: number; y: number }>;
}

export interface Puppet {
  art: Phaser.GameObjects.Container;
  joints: Record<string, Phaser.GameObjects.Container>;
  images: Record<string, Phaser.GameObjects.Image>;
  // Joint angle that reproduces the sheet's drawn pose, per bone.
  drawn: Record<string, number>;
  // Where each tuding attaches, in its joint's local frame.
  tudings: Record<string, { x: number; y: number }>;
  // Named spots resolved to their joints; see pointToWorld.
  points: Record<string, { joint: Phaser.GameObjects.Container; x: number; y: number }>;
  // Bottom of the lowest piece, in art-local pixels (for placing the feet).
  footY: number;
  height: number;
}

export function pieceKey(character: string, piece: string): string {
  return `${character}/${piece}`;
}

export function buildPuppet(scene: Phaser.Scene, character: string, rig: RigData): Puppet {
  const byName = new Map(rig.bones.map((b) => [b.name, b]));
  const joints: Puppet['joints'] = {};
  const images: Puppet['images'] = {};
  const drawn: Puppet['drawn'] = {};
  const tudings: Puppet['tudings'] = {};
  const art = scene.add.container();
  let top = Infinity;
  let footY = -Infinity;

  for (const bone of rig.bones) {
    const piece = rig.pieces[bone.piece];
    const joint = scene.add.container();
    const inner = scene.add.container().setAngle(-bone.rest);
    images[bone.name] = scene.add.image(piece.x - bone.pivot[0], piece.y - bone.pivot[1], pieceKey(character, bone.piece)).setOrigin(0);
    inner.add(images[bone.name]);
    joint.add(inner);

    const parent = bone.parent ? byName.get(bone.parent)! : undefined;
    const parentRest = parent?.rest ?? 0;
    if (parent && bone.at) {
      const p = rotate(bone.at[0] - parent.pivot[0], bone.at[1] - parent.pivot[1], -parentRest);
      joint.setPosition(p.x, p.y);
      // Bones on the root share its frame, so they sit in art for draw ordering.
      if (parent.parent) joints[parent.name].add(joint);

      if (!parent.parent) {
        top = Math.min(top, p.y + piece.y - bone.pivot[1]);
        footY = Math.max(footY, p.y + piece.y + piece.h - bone.pivot[1]);
      }
    }

    drawn[bone.name] = bone.rest ? bone.rest - parentRest : bone.angle;
    joint.angle = drawn[bone.name];
    if (bone.tuding) tudings[bone.name] = rotate(bone.tuding[0] - bone.pivot[0], bone.tuding[1] - bone.pivot[1], -bone.rest);
    joints[bone.name] = joint;
  }

  for (const name of rig.drawOrder) {
    const bone = byName.get(name)!;
    const parent = bone.parent ? byName.get(bone.parent) : undefined;
    if (!parent?.parent) art.add(joints[name]);
  }

  const points: Puppet['points'] = {};
  for (const [name, p] of Object.entries(rig.points ?? {})) points[name] = { joint: joints[p.bone], x: p.x, y: p.y };

  return { art, joints, images, drawn, tudings, points, footY, height: footY - top };
}

export function pointToWorld(point: Puppet['points'][string]): Phaser.Types.Math.Vector2Like {
  return point.joint.getWorldTransformMatrix().transformPoint(point.x, point.y);
}

function rotate(x: number, y: number, degrees: number): { x: number; y: number } {
  const r = Phaser.Math.DegToRad(degrees);
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: x * c - y * s, y: x * s + y * c };
}
