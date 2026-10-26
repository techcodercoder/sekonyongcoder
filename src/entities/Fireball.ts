import Phaser from 'phaser';
import gsap from 'gsap';
import { AJI, GAME } from '../constants';
import type { FireballEvent, Fighter } from './Fighter';
import type { Move } from '../constants';

const DT = 1 / GAME.fps;

// A fireball flung from a fighter's tail. Moves one logic frame per tick()
// on a shallow arc, leaving embers; the match checks it against fighters and
// other fireballs.
export class Fireball {
  readonly owner: Fighter;
  readonly move: Move;
  readonly direction: number;
  readonly power: number;
  alive = true;

  private body: Phaser.GameObjects.Container;
  private radius: number;
  private age = 0;

  constructor(
    private scene: Phaser.Scene,
    e: FireballEvent,
    private onTrail: (x: number, y: number, size: number) => void,
  ) {
    this.owner = e.owner;
    this.move = e.move;
    this.direction = e.direction;
    this.power = e.power;
    this.radius = AJI.fireball.radius * e.power;
    const r = this.radius;
    this.body = scene.add
      .container(e.x, e.y, [
        scene.add.circle(0, 0, r * 1.6, 0xd8341a, 0.35),
        scene.add.circle(0, 0, r, 0xff6a1a),
        scene.add.circle(r * 0.15 * e.direction, 0, r * 0.55, 0xffe08a),
      ])
      .setDepth(50);
    gsap.fromTo(this.body, { scale: 0.3 }, { scale: 1, duration: 0.12, ease: 'back.out(2)' });
    gsap.to(this.body.list[0] as Phaser.GameObjects.Arc, { scale: 1.25, duration: 0.12, yoyo: true, repeat: -1 });
  }

  get x(): number {
    return this.body.x;
  }

  get y(): number {
    return this.body.y;
  }

  area(): Phaser.Geom.Rectangle {
    const r = this.radius;
    return new Phaser.Geom.Rectangle(this.x - r, this.y - r, r * 2, r * 2);
  }

  tick(): void {
    if (!this.alive) return;
    this.body.x += AJI.fireball.speed * this.direction * DT;
    this.body.y += AJI.fireball.drop * DT;
    if (++this.age % AJI.fireball.trailEvery === 0) this.onTrail(this.x, this.y, this.power);

    const offscreen = this.x < -50 || this.x > this.scene.scale.width + 50;
    if (offscreen || this.age > AJI.fireball.lifeFrames) this.destroy();
  }

  destroy(): void {
    if (!this.alive) return;
    this.alive = false;
    gsap.killTweensOf([this.body, ...this.body.list]);
    gsap.to(this.body, { scale: 0, alpha: 0, duration: 0.12, onComplete: () => this.body.destroy() });
  }
}
