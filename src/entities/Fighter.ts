import Phaser from 'phaser';
import gsap from 'gsap';
import {
  AJI,
  COLORS,
  COMBO,
  FIGHTER,
  GAME,
  KELIR,
  POSE,
  SPRING,
  STICKS,
  type JointKey,
  type JointPose,
  type Move,
  type MoveId,
} from '../constants';
import { NO_INPUT, type InputState } from '../systems/InputController';
import { buildPuppet, pieceKey, pointToWorld, type Puppet, type RigData } from './Puppet';
import hanomanRig from '../assets/characters/hanoman/rig.json';

type State = 'idle' | 'walk' | 'jump' | 'attack' | 'hitstun' | 'blockstun' | 'knockdown' | 'lying' | 'getup' | 'ko';
type Button = 'hand' | 'kick';
type Action = Button | 'jump' | 'ekorApi';
type Size = 'normal' | 'big' | 'small';
type Joint = Phaser.GameObjects.Container;
type Angle = { angle: number };

// A joint chasing its animated target (see SPRING). Without a config the
// joint just copies the target, as legs do.
interface Spring {
  joint: Joint;
  target: Angle;
  angle: number;
  vel: number;
  cfg?: { k: number; c: number; coupling: number };
  kick: number; // deg/s added on a hit
  parent?: Spring; // the upper arm for an elbow, for its world orientation
}

export type HitResult = 'hit' | 'block' | 'ko';

export interface FireballEvent {
  owner: Fighter;
  move: Move;
  x: number; // world position of the tail tip
  y: number;
  direction: number;
  power: number;
}

export const FLOOR_Y = GAME.height - KELIR.floorHeight;
const DT = 1 / GAME.fps; // seconds per logic frame
const HALF_H = FIGHTER.bodyHeight / 2;

// A wayang fighter. Logic advances one fixed frame per tick() so frame data
// is exact; GSAP only animates the puppet to match the current state.
//
// The puppet is built like a real wayang: a rigid body on a gapit stick,
// jointed arms on tuding sticks, and legs that can kick. The container's
// origin is the body center; feet touch y + bodyHeight / 2. A sizer
// container (Aji Triwikrama / Mengecil) scales the rig about the feet, and
// the rig inside it is mirrored for facing.
//
// Events: 'fireball' (FireballEvent), 'jump' and 'land' (x, y of the feet),
// 'aji' (name), 'denied' (an Aji the meter cannot pay for).
export class Fighter extends Phaser.GameObjects.Container {
  health: number = FIGHTER.maxHealth;
  meter = 0;
  opponent!: Fighter;
  state: State = 'idle';
  move?: Move;
  // Whether the current move has already connected (one hit per move).
  moveConnected = false;
  vx = 0;
  vy = 0;

  private held: InputState = NO_INPUT;
  private grounded = true;
  private stateFrames = 0;
  private moveFrame = 0;
  private activeUntil = 0;
  private recovering = false;
  private queued?: Button;
  private buffered?: { action: Action; frames: number };
  private airStringUsed = false;
  private lunge = 0;
  private size: Size = 'normal';
  private sizeFrames = 0;
  private baseTint?: number;

  private sizer: Phaser.GameObjects.Container;
  private rig: Phaser.GameObjects.Container;
  private joints!: Record<JointKey, Joint>;
  // What GSAP animates; springs carry the joints toward these.
  private targets!: Record<JointKey, Angle>;
  private sashTargets: Angle[] = [];
  private springs: Spring[] = [];
  private springOf = new Map<Angle, Spring>();
  private prevMotion = { vx: 0, vy: 0, tilt: 0, tiltVel: 0 };
  private tudings: { stick: Joint; shoulder: Joint; elbow: Joint }[] = [];
  private tail!: Joint;
  private sashes: Joint[] = [];
  private images: Phaser.GameObjects.Image[] = [];
  private tailImage?: Phaser.GameObjects.Image;
  private tailTip?: Puppet['points'][string];
  private visualTl?: gsap.core.Timeline;
  private shownPose?: string;

  constructor(scene: Phaser.Scene, x: number, facing: number, tint?: number) {
    super(scene, x, FLOOR_Y - HALF_H);
    scene.add.existing(this);

    this.rig = scene.add.container(0, 0);
    this.sizer = scene.add.container(0, 0, [this.rig]);
    this.add(this.sizer);
    if (FIGHTER.art.enabled && scene.textures.exists(pieceKey('hanoman', 'torso'))) this.buildPuppetRig();
    else this.buildRig();
    this.rig.scaleX = facing;

    if (tint !== undefined) {
      this.baseTint = tint;
      for (const img of this.images) img.setTint(tint);
    }

    this.setupSprings();
    this.showPose('idle');
    this.swayTail();
    gsap.to(this.sashTargets, { angle: 5, duration: 0.9, ease: 'sine.inOut', yoyo: true, repeat: -1, stagger: 0.3 });
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      gsap.killTweensOf([this.rig, this.sizer, ...this.sashTargets, ...Object.values(this.targets)]),
    );
  }

  get facing(): number {
    return this.rig.scaleX;
  }

  get feetY(): number {
    return this.y + HALF_H;
  }

  get sizeScale(): number {
    return this.size === 'big' ? AJI.triwikrama.scale : this.size === 'small' ? AJI.mengecil.scale : 1;
  }

  get power(): number {
    return this.size === 'big' ? AJI.triwikrama.power : this.size === 'small' ? AJI.mengecil.power : 1;
  }

  // What the meter shows: Triwikrama's time left while it lasts.
  get meterShown(): number {
    return this.size === 'big' ? (this.sizeFrames / AJI.triwikrama.frames) * AJI.max : this.meter;
  }

  get invulnerable(): boolean {
    return this.state === 'knockdown' || this.state === 'lying' || this.state === 'getup' || this.state === 'ko';
  }

  // Free to act; the CPU uses this to time its own presses.
  get actionable(): boolean {
    return this.state === 'idle' || this.state === 'walk';
  }

  hurtbox(): Phaser.Geom.Rectangle {
    const k = this.sizeScale;
    const w = FIGHTER.bodyWidth * k;
    const h = FIGHTER.bodyHeight * k;
    return new Phaser.Geom.Rectangle(this.x - w / 2, this.feetY - h, w, h);
  }

  // The current move's hitbox while it is active and has not connected yet.
  hitbox(): Phaser.Geom.Rectangle | null {
    const m = this.move;
    if (this.state !== 'attack' || !m || m.fireball || this.moveConnected) return null;
    const startup = m.windUpFrames + m.strikeFrames;
    if (this.moveFrame < startup || this.moveFrame >= this.activeUntil) return null;
    // The sizer keeps the feet in place, so the hitbox scales about them.
    const k = this.sizeScale;
    const x = m.hit.x * k;
    const w = m.hit.w * k;
    const y = HALF_H + (m.hit.y - HALF_H) * k;
    const left = this.facing > 0 ? this.x + x : this.x - x - w;
    return new Phaser.Geom.Rectangle(left, this.y + y, w, m.hit.h * k);
  }

  gainMeter(amount: number): void {
    if (this.size !== 'big') this.meter = Math.min(AJI.max, this.meter + amount);
  }

  // Lets the round intro and outro hold fighters still.
  freezeInPlace(): void {
    this.vx = 0;
    this.held = NO_INPUT;
  }

  tick(input: InputState): void {
    this.held = input;
    this.bufferPress(input);

    if (this.sizeFrames > 0 && --this.sizeFrames === 0) this.resize('normal', AJI.triwikrama.growDuration);

    switch (this.state) {
      case 'idle':
      case 'walk':
        this.tickNeutral(input);
        break;
      case 'jump': {
        const b = this.buffered?.action;
        if ((b === 'hand' || b === 'kick') && !this.airStringUsed) {
          this.buffered = undefined;
          this.airStringUsed = true;
          this.startMove(COMBO.start.air[b]);
        }
        this.tickSizeAji(input);
        break;
      }
      case 'attack':
        this.tickMove(input);
        break;
      case 'hitstun':
      case 'blockstun':
        this.vx *= FIGHTER.pushbackFriction;
        if (--this.stateFrames <= 0) this.toNeutral();
        break;
      case 'lying':
        if (--this.stateFrames <= 0) this.getUp();
        break;
      case 'getup':
        if (--this.stateFrames <= 0) this.toNeutral();
        break;
      case 'knockdown':
        this.vx *= 0.99;
        break;
      case 'ko':
        break;
    }

    this.physics();
    this.updateSprings();
    this.syncTudings();
  }

  // Remembers the latest action press for a few frames (see FIGHTER.inputBuffer).
  private bufferPress(input: InputState): void {
    const action: Action | undefined = input.handPressed
      ? 'hand'
      : input.kickPressed
        ? 'kick'
        : input.ekorApiPressed
          ? 'ekorApi'
          : input.jumpPressed
            ? 'jump'
            : undefined;
    if (action) this.buffered = { action, frames: FIGHTER.inputBuffer };
    else if (this.buffered && --this.buffered.frames <= 0) this.buffered = undefined;
  }

  private tickNeutral(input: InputState): void {
    this.faceOpponent();
    const action = this.buffered?.action;
    if (action) {
      this.buffered = undefined;
      if (action === 'jump') return this.jump(input);
      if (action === 'ekorApi') return this.ekorApi();
      return this.startMove(COMBO.start.ground[action]);
    }
    this.tickSizeAji(input);

    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const speed = (dir === this.facing ? FIGHTER.walkForward : FIGHTER.walkBack) * this.speedScale;
    this.vx = dir * speed;
    this.enterState(dir ? 'walk' : 'idle');
  }

  private tickSizeAji(input: InputState): void {
    if (input.triwikramaPressed) this.triwikrama();
    if (input.mengecilPressed) this.mengecil();
  }

  private get speedScale(): number {
    return this.size === 'big' ? AJI.triwikrama.speed : this.size === 'small' ? AJI.mengecil.speed : 1;
  }

  private faceOpponent(): void {
    const dir = Math.sign(this.opponent.x - this.x);
    if (dir && dir !== this.facing) {
      this.rig.scaleX = dir;
      this.shownPose = undefined; // walk/jump tilt depends on facing
    }
  }

  private jump(input: InputState): void {
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    this.vx = dir * FIGHTER.jumpForward * this.speedScale;
    this.vy = -FIGHTER.jumpVelocity;
    this.grounded = false;
    this.enterState('jump');
    this.emit('jump', this.x, this.feetY);
    if (dir === this.facing) this.salto();
  }

  // ---- moves ----

  private startMove(id: MoveId): void {
    const m: Move = COMBO.moves[id];
    this.move = m;
    this.moveFrame = 0;
    this.moveConnected = false;
    this.queued = undefined;
    this.lunge = 0;
    this.recovering = false;
    this.activeUntil = m.dive ? Infinity : m.windUpFrames + m.strikeFrames + m.active;
    if (m.hop > 0) {
      this.vy = -m.hop;
      this.grounded = false;
    }
    if (this.grounded) this.vx = 0;
    this.state = 'attack';
    this.shownPose = 'attack';
    this.playMoveVisual(m);
  }

  private tickMove(input: InputState): void {
    const m = this.move!;
    const f = ++this.moveFrame;
    const startup = m.windUpFrames + m.strikeFrames;
    if (input.handPressed) this.queued = 'hand';
    if (input.kickPressed) this.queued = 'kick';

    if (f === startup) this.onStrike(m);
    if (this.lunge > 0) {
      this.vx = this.lunge * this.facing;
      this.lunge = Math.max(0, this.lunge - m.lunge / COMBO.lungeDecay);
    } else if (this.grounded) {
      this.vx = 0;
    }

    if (f < this.activeUntil) return;
    const next = this.queued && m.next[this.queued];
    if (next) return this.startMove(next);
    if (!this.recovering) {
      this.recovering = true;
      this.recoverVisual(m.recovery);
    }
    if (f >= this.activeUntil + m.recovery) this.toNeutral();
  }

  private onStrike(m: Move): void {
    this.lunge = m.lunge;
    if (m.dive) this.vy = m.dive;
    if (m.fireball) {
      this.scene.cameras.main.shake(m.shake.duration, m.shake.intensity);
      // The placeholder has no tail tip point; use the top of its tail curl.
      const tip = this.tailTip ? pointToWorld(this.tailTip) : this.tail.getWorldTransformMatrix().transformPoint(-13, -58);
      const event: FireballEvent = { owner: this, move: m, x: tip.x!, y: tip.y!, direction: this.facing, power: this.power };
      this.emit('fireball', event);
    }
  }

  // Attacker side of a blow that connected.
  onConnect(result: HitResult): void {
    const m = this.move;
    this.moveConnected = true;
    if (m) this.scene.cameras.main.shake(m.shake.duration, m.shake.intensity);
    this.gainMeter(result === 'block' ? AJI.gainBlock : AJI.gainHit);
  }

  // Defender side. `power` is the attacker's size multiplier.
  receiveHit(m: Move, attackerX: number, power: number): HitResult {
    const dir = Math.sign(this.x - attackerX) || -this.facing;
    if (this.canBlock(attackerX)) {
      this.health = Math.max(1, this.health - (m.fireball ? Math.round(m.damage * power * AJI.fireball.chip) : 0));
      this.move = undefined;
      this.vx = dir * m.pushback * power * 0.6;
      this.stateFrames = m.blockstun;
      this.enterState('blockstun');
      this.kickSprings(SPRING.blockKick);
      return 'block';
    }

    this.health = Math.max(0, this.health - Math.round(m.damage * power));
    this.move = undefined;
    this.kickSprings(1);
    this.gainMeter(AJI.gainHurt);
    if (this.health === 0) {
      this.ko(dir);
      return 'ko';
    }
    if (m.launch || !this.grounded) {
      this.vx = dir * m.pushback * power;
      this.vy = -520;
      this.grounded = false;
      this.enterState('knockdown');
    } else {
      this.vx = dir * m.pushback * power;
      this.stateFrames = m.hitstun;
      this.enterState('hitstun');
    }
    return 'hit';
  }

  private canBlock(attackerX: number): boolean {
    const blockable = this.state === 'idle' || this.state === 'walk' || this.state === 'blockstun';
    const away = attackerX > this.x ? this.held.left : this.held.right;
    return blockable && this.grounded && away;
  }

  private ko(dir: number): void {
    const k = FIGHTER.koLaunch;
    this.state = 'ko';
    this.vx = dir * k.vx;
    this.vy = k.vy;
    this.grounded = false;
    this.killVisuals();
    // Dibuang: the dalang flings the beaten puppet off the kelir, spinning.
    gsap.to(this.rig, { angle: `+=${k.spin * dir}`, duration: 1.4, ease: 'none' });
    this.tweenJoints(gsap.timeline(), { frontArm: -150, backArm: 160, frontLeg: -60, backLeg: 50 }, { duration: 0.2 }, 0);
  }

  // Round won: settle into the stance and hold.
  celebrate(): void {
    this.freezeInPlace();
    if (this.state !== 'ko') this.toNeutral();
  }

  private toNeutral(): void {
    this.move = undefined;
    this.queued = undefined;
    this.enterState(this.grounded ? 'idle' : 'jump');
    if (!gsap.isTweening(this.targets.tail)) this.swayTail();
  }

  private getUp(): void {
    this.stateFrames = FIGHTER.getUp;
    this.enterState('getup');
  }

  // ---- physics ----

  private physics(): void {
    if (!this.grounded) this.vy += GAME.gravityY * DT;
    this.x += this.vx * DT;
    this.y += this.vy * DT;
    if (this.state === 'ko') return;

    if (this.feetY >= FLOOR_Y && this.vy >= 0) {
      this.y = FLOOR_Y - HALF_H;
      this.vy = 0;
      if (!this.grounded) {
        this.grounded = true;
        this.onLand();
      }
    } else if (this.feetY < FLOOR_Y - 0.5) {
      this.grounded = false;
    }

    const margin = KELIR.wallMargin;
    this.x = Phaser.Math.Clamp(this.x, margin, GAME.width - margin);
  }

  private onLand(): void {
    this.airStringUsed = false;
    this.emit('land', this.x, this.feetY);
    if (this.state === 'jump') this.toNeutral();
    else if (this.state === 'knockdown') {
      this.vx = 0;
      this.stateFrames = FIGHTER.knockdownLie;
      this.enterState('lying');
    } else if (this.state === 'attack' && this.move?.dive) {
      this.lunge = 0;
      this.vx = 0;
      this.activeUntil = this.moveFrame; // the dive ends on impact
      this.emit('land', this.x, this.feetY, true);
    }
  }

  // ---- aji ----

  private triwikrama(): void {
    const p = AJI.triwikrama;
    if (this.size === 'big') return;
    if (this.meter < p.cost) return void this.emit('denied');
    this.meter = 0;
    this.sizeFrames = p.frames;
    this.resize('big', p.growDuration);
    this.emit('aji', 'triwikrama');
  }

  private ekorApi(): void {
    if (this.meter < AJI.ekorApi.cost) return void this.emit('denied');
    this.meter -= AJI.ekorApi.cost;
    this.emit('aji', 'ekorApi');
    this.startMove('ekorApi');
  }

  private mengecil(): void {
    if (this.size === 'big') return;
    const small = this.size !== 'small';
    this.resize(small ? 'small' : 'normal', AJI.mengecil.shrinkDuration);
    if (small) this.emit('aji', 'mengecil');
  }

  private resize(size: Size, duration: number): void {
    this.size = size;
    const k = this.sizeScale;
    gsap.to(this.sizer, { scale: k, y: -(k - 1) * HALF_H, duration, ease: AJI.sizeEase });
  }

  // ---- visuals ----

  private enterState(state: State): void {
    this.state = state;
    this.showPose(state);
  }

  private killVisuals(): void {
    this.visualTl?.kill();
    const limbs = Object.entries(this.targets).filter(([k]) => k !== 'tail').map(([, t]) => t);
    gsap.killTweensOf([this.rig, ...limbs]);
  }

  // Animates the puppet into the pose for a state, once per change.
  private showPose(state: State): void {
    if (this.shownPose === state) return;
    this.shownPose = state;
    if (state === 'lying') return; // keep the fall animation running
    this.killVisuals();
    const tl = gsap.timeline();
    this.visualTl = tl;
    const { frontArm, backArm, frontElbow, backElbow, frontLeg, backLeg } = this.targets;
    const base = POSE.stance;
    const f = this.facing;
    const settle = { duration: POSE.settleDuration };

    if (state === 'idle') {
      const p = POSE.idle;
      const loop = { duration: p.duration, ease: p.ease, yoyo: true, repeat: -1 };
      tl.to(this.rig, { y: 0, angle: 0, ...settle }, 0);
      this.tweenJoints(tl, { ...base, frontArm: base.frontArm + p.armSwing, backArm: base.backArm + p.armSwing }, settle, 0);
      tl.addLabel('loop');
      tl.to(frontArm, { angle: base.frontArm - p.armSwing, ...loop }, 'loop');
      tl.to(backArm, { angle: base.backArm - p.armSwing, ...loop }, 'loop');
    } else if (state === 'walk') {
      const p = POSE.walk;
      const loop = { duration: p.duration, ease: p.ease, yoyo: true, repeat: -1, repeatDelay: p.hold };
      tl.to(this.rig, { y: 0, angle: 0, ...settle }, 0);
      this.tweenJoints(
        tl,
        {
          ...base,
          frontArm: base.frontArm + p.armSwing,
          backArm: base.backArm - p.armSwing,
          frontLeg: base.frontLeg - p.legSwing,
          backLeg: base.backLeg + p.legSwing,
        },
        settle,
        0,
      );
      tl.addLabel('loop');
      tl.to(this.rig, { y: -p.bob, angle: p.tilt * f, ...loop }, 'loop');
      tl.to(frontArm, { angle: base.frontArm - p.armSwing, ...loop }, 'loop');
      tl.to(backArm, { angle: base.backArm + p.armSwing, ...loop }, 'loop');
      tl.to(frontLeg, { angle: base.frontLeg + p.legSwing, ...loop }, 'loop');
      tl.to(backLeg, { angle: base.backLeg - p.legSwing, ...loop }, 'loop');
    } else if (state === 'jump') {
      const p = POSE.jump;
      const snap = { duration: p.duration, ease: p.ease };
      if (!gsap.isTweening(this.rig)) tl.to(this.rig, { y: 0, angle: p.tilt * f, ...snap }, 0);
      tl.to(backArm, { angle: p.backArm, ...snap }, 0);
      tl.to(frontArm, { angle: p.frontArm, ...snap }, 0);
      tl.to([frontElbow, backElbow], { angle: p.elbow, ...snap }, 0);
      tl.to(frontLeg, { angle: p.frontLeg, ...snap }, 0);
      tl.to(backLeg, { angle: p.backLeg, ...snap }, 0);
    } else if (state === 'hitstun' || state === 'blockstun') {
      const p = state === 'hitstun' ? POSE.hurt : POSE.guard;
      const { tilt, ...limbs } = p;
      const snap = { duration: 0.06, ease: 'power3.out' };
      tl.to(this.rig, { y: 0, angle: tilt * f, ...snap }, 0);
      this.tweenJoints(tl, limbs, snap, 0);
    } else if (state === 'knockdown') {
      // Falls on its back: lean away from the facing direction.
      tl.to(this.rig, { angle: -80 * f, y: HALF_H - 25, duration: 0.35, ease: 'power2.out' }, 0);
      this.tweenJoints(tl, { frontArm: -150, backArm: 150, frontLeg: -50, backLeg: 30 }, { duration: 0.2 }, 0);
    } else if (state === 'getup') {
      tl.to(this.rig, { angle: 0, y: 0, duration: (FIGHTER.getUp / GAME.fps) * 0.8, ease: 'back.out(1.5)' }, 0);
      this.tweenJoints(tl, base, { duration: 0.2 }, 0);
    }
  }

  private playMoveVisual(m: Move): void {
    this.killVisuals();
    const tl = gsap.timeline();
    this.visualTl = tl;
    const f = this.facing;
    const windUp = { duration: m.windUpFrames * DT, ease: 'power2.out' };
    const strikeAt = m.windUpFrames * DT;
    const strikeDur = m.strikeFrames * DT;

    if (m.fire) this.burnTail((m.windUpFrames + m.strikeFrames + m.recovery) * DT);
    if (m.windUp.tail !== undefined || m.strike.tail !== undefined) gsap.killTweensOf(this.targets.tail);

    this.tweenJoints(tl, m.windUp, windUp, 0);
    tl.to(this.rig, { angle: m.bodyTilt.windUp * f, y: 0, ...windUp }, 0);
    this.tweenJoints(tl, m.strike, { duration: strikeDur, ease: 'power4.in' }, strikeAt);
    const lean = m.bodyTilt.strike + (m.spin ?? 0);
    tl.to(this.rig, { angle: lean * f, duration: strikeDur, ease: m.spin ? 'power2.out' : 'power4.in' }, strikeAt);
  }

  private recoverVisual(frames: number): void {
    this.killVisuals();
    const tl = gsap.timeline();
    this.visualTl = tl;
    const recover = { duration: frames * DT * 0.9, ease: 'power2.inOut' };
    this.tweenJoints(tl, { ...POSE.stance, tail: 0 }, recover, 0);
    tl.to(this.rig, { angle: 0, ...recover }, 0);
  }

  private salto(): void {
    const p = POSE.salto;
    gsap.killTweensOf(this.rig);
    gsap.fromTo(this.rig, { angle: 0 }, { angle: 360 * this.facing, duration: p.duration, ease: p.ease });
  }

  private swayTail(): void {
    this.normalizeTarget(this.targets.tail);
    gsap.fromTo(this.targets.tail, { angle: 0 }, { angle: 8, duration: 1.1, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  }

  private burnTail(seconds: number): void {
    this.tailImage?.setTint(0xff8a3d);
    this.scene.time.delayedCall(seconds * 1000, () => {
      if (this.baseTint === undefined) this.tailImage?.clearTint();
      else this.tailImage?.setTint(this.baseTint);
    });
  }

  private tweenJoints(tl: gsap.core.Timeline, pose: JointPose, vars: gsap.TweenVars, at: number): void {
    for (const [key, angle] of Object.entries(pose) as [JointKey, number][]) {
      this.normalizeTarget(this.targets[key]);
      tl.to(this.targets[key], { angle, ...vars }, at);
    }
  }

  // Targets are plain numbers, so unlike a Phaser angle they never wrap.
  // Wrapping before each new tween keeps it taking the short way round (a
  // strike that ended at 290 recovers from -70); the spring shifts with it.
  private normalizeTarget(target: Angle): void {
    const wrapped = Phaser.Math.Angle.WrapDegrees(target.angle);
    const shift = wrapped - target.angle;
    if (!shift) return;
    target.angle = wrapped;
    const spring = this.springOf.get(target);
    if (spring) spring.angle += shift;
  }

  // ---- secondary motion ----

  private setupSprings(): void {
    const cfg = SPRING.joints;
    const kick = SPRING.hitKick;
    const make = (joint: Joint, conf?: Spring['cfg'], hitKick = 0, parent?: Spring): Spring => {
      const target = { angle: joint.angle };
      const spring: Spring = { joint, target, angle: joint.angle, vel: 0, cfg: SPRING.enabled ? conf : undefined, kick: hitKick, parent };
      this.springs.push(spring);
      this.springOf.set(target, spring);
      return spring;
    };
    const j = this.joints;
    const frontArm = make(j.frontArm, cfg.frontArm, kick.arm);
    const backArm = make(j.backArm, cfg.backArm, kick.arm);
    this.targets = {
      frontArm: frontArm.target,
      backArm: backArm.target,
      frontElbow: make(j.frontElbow, cfg.frontElbow, kick.elbow, frontArm).target,
      backElbow: make(j.backElbow, cfg.backElbow, kick.elbow, backArm).target,
      frontLeg: make(j.frontLeg).target,
      backLeg: make(j.backLeg).target,
      tail: make(j.tail, cfg.tail, kick.tail).target,
    };
    this.sashTargets = this.sashes.map((sash) => make(sash, cfg.sash, kick.sash).target);
  }

  // Runs once per logic frame, so hit-stop freezes it with everything else.
  private updateSprings(): void {
    const m = this.prevMotion;
    const facing = this.facing;
    // Body acceleration in the puppet's own frame: forward is +x.
    const ax = ((this.vx - m.vx) / DT) * facing;
    const ay = (this.vy - m.vy) / DT;
    const tilt = this.rig.angle * facing;
    const tiltVel = Phaser.Math.Angle.WrapDegrees(tilt - m.tilt) / DT;
    const tiltAcc = (tiltVel - m.tiltVel) / DT;
    Object.assign(m, { vx: this.vx, vy: this.vy, tilt, tiltVel });

    for (const s of this.springs) {
      if (!s.cfg) {
        s.angle = s.target.angle;
        s.joint.angle = s.angle;
        continue;
      }
      const { k, c, coupling } = s.cfg;
      // A limb hanging at angle 0 points down; positive swings it backward.
      // Accelerating forward leaves it behind, accelerating up drops it.
      const o = Phaser.Math.DegToRad(s.angle + (s.parent?.angle ?? 0));
      const push = coupling * (ax * Math.cos(o) + ay * Math.sin(o)) - SPRING.spinCoupling * tiltAcc;
      const acc = k * (s.target.angle - s.angle) - c * s.vel + push;
      s.vel = Phaser.Math.Clamp(s.vel + acc * DT, -SPRING.maxSpeed, SPRING.maxSpeed);
      s.angle += s.vel * DT;
      s.joint.angle = s.angle;
    }
  }

  // Limbs fling back from a blow; `share` scales it down for blocks.
  private kickSprings(share: number): void {
    for (const s of this.springs) {
      if (s.cfg) s.vel += s.kick * share * (0.7 + Math.random() * 0.5);
    }
  }

  // The dalang holds the tuding from below, so the sticks stay near vertical
  // in world space whatever the arm is doing.
  private syncTudings(): void {
    const tiltLocal = this.rig.angle * this.rig.scaleX;
    for (const t of this.tudings) {
      t.stick.angle = STICKS.tudingSlant - t.shoulder.angle - t.elbow.angle - tiltLocal;
    }
  }

  // ---- rig building ----

  // Puppet assembled from the parts sheet (see scripts/build-rig.py).
  // The art is drawn at sheet resolution and scaled down as a whole.
  private buildPuppetRig(): void {
    const puppet = buildPuppet(this.scene, 'hanoman', hanomanRig as unknown as RigData);
    const scale = FIGHTER.art.height / puppet.height;
    puppet.art.setScale(scale).setY(HALF_H - puppet.footY * scale + FIGHTER.art.footDrop);

    const j = puppet.joints;
    this.joints = {
      frontArm: j.frontUpper,
      frontElbow: j.frontFore,
      backArm: j.backUpper,
      backElbow: j.backFore,
      frontLeg: j.legFront,
      backLeg: j.legBack,
      tail: j.tail,
    };
    this.tail = j.tail;
    this.tailImage = puppet.images.tail;
    this.tailTip = puppet.points.tailTip;
    this.images = Object.values(puppet.images);
    this.sashes = [j.sashA, j.sashB];

    for (const [forearm, shoulder] of [['frontFore', j.frontUpper], ['backFore', j.backUpper]] as const) {
      const at = puppet.tudings[forearm];
      if (!at || !STICKS.show) continue;
      const stick = this.buildTuding(1 / scale).setPosition(at.x, at.y);
      j[forearm].add(stick);
      this.tudings.push({ stick, shoulder, elbow: j[forearm] });
    }

    this.rig.add([this.buildGapit(), puppet.art]);
  }

  // Sizes are divided by the parent's scale so sticks look the same on any rig.
  private buildTuding(factor = 1): Joint {
    const g = this.scene.add.graphics();
    const w = STICKS.tudingWidth * factor;
    g.fillStyle(STICKS.color).fillRect(-w / 2, 0, w, STICKS.tudingLength * factor);
    return this.scene.add.container(0, 0, [g]);
  }

  private buildGapit(): Phaser.GameObjects.Graphics {
    const gapit = this.scene.add.graphics();
    if (STICKS.show) {
      gapit.fillStyle(STICKS.color);
      gapit.fillRect(-STICKS.gapitWidth / 2, -30, STICKS.gapitWidth, HALF_H + 30 + STICKS.gapitLength);
    }
    return gapit;
  }

  // Placeholder silhouette. Draw order is back to front. Its legs are drawn
  // into the body, so the leg joints are empty stand-ins.
  private buildRig(): void {
    const s = this.scene;
    const ink = COLORS.silhouette;
    const hole = COLORS.tatahan;
    const footY = HALF_H;
    const gapit = this.buildGapit();

    this.tail = s.add.container(-10, 14);
    const tail = s.add.graphics();
    tail.lineStyle(6, ink);
    tail.beginPath();
    tail.arc(-22, -30, 30, Math.PI * 0.4, Math.PI * 1.6, false);
    tail.strokePath();
    tail.fillStyle(ink).fillCircle(-13, -58, 7);
    this.tail.add(tail);

    const [backArm, backElbow] = this.buildArm(-10, false);
    const [frontArm, frontElbow] = this.buildArm(10, true);
    this.joints = { frontArm, frontElbow, backArm, backElbow, frontLeg: s.add.container(), backLeg: s.add.container(), tail: this.tail };

    // One rigid piece: legs in a wide gagahan stance, torso, cloth and head.
    const body = s.add.graphics();
    const poly = (pts: number[]) => {
      const points: Phaser.Geom.Point[] = [];
      for (let i = 0; i < pts.length; i += 2) points.push(new Phaser.Geom.Point(pts[i], pts[i + 1]));
      body.fillPoints(points, true);
    };
    body.fillStyle(ink);
    poly([-12, 14, -2, 14, -14, footY - 5, -24, footY - 5]); // back leg
    body.fillRect(-26, footY - 7, 20, 7);
    poly([2, 14, 12, 14, 22, footY - 5, 12, footY - 5]); // front leg
    body.fillRect(10, footY - 7, 22, 7);
    poly([-14, -44, 15, -44, 11, 8, -10, 8]); // torso

    body.fillStyle(hole);
    for (let i = 0; i < 4; i++) body.fillCircle(1, -34 + i * 10, 2);
    body.fillCircle(-6, -24, 1.5).fillCircle(8, -24, 1.5);

    // Kampuh poleng: the checkered cloth Hanoman wears.
    body.fillStyle(ink).fillRect(-14, 2, 30, 22);
    body.fillStyle(hole);
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        if ((row + col) % 2 === 0) body.fillRect(-12 + col * 7, 4 + row * 6.5, 5, 5);
      }
    }

    // Head, profile facing forward.
    body.fillStyle(ink);
    body.fillCircle(8, -56, 14);
    body.fillEllipse(21, -51, 16, 11);
    body.fillTriangle(-2, -66, -16, -78, 6, -70); // topknot
    body.fillStyle(hole).fillCircle(13, -59, 2.5).fillRect(18, -49, 8, 1.5);

    this.rig.add([gapit, this.tail, backArm, body, frontArm]);
  }

  private buildArm(x: number, withGada: boolean): [Joint, Joint] {
    const s = this.scene;
    const ink = COLORS.silhouette;

    const shoulder = s.add.container(x, -36);
    const upper = s.add.graphics();
    upper.fillStyle(ink).fillRect(-4, 0, 8, 32);

    const elbow = s.add.container(0, 32);
    const fore = s.add.graphics();
    fore.fillStyle(ink).fillRect(-3.5, 0, 7, 34).fillCircle(0, 36, 4.5);

    if (withGada) {
      fore.fillRect(0, 33, 24, 5); // handle
      fore.fillRoundedRect(22, 28, 22, 15, 6); // head
      fore.fillStyle(COLORS.tatahan);
      for (let i = 0; i < 3; i++) fore.fillCircle(27 + i * 6, 35.5, 1.6);
    }

    if (STICKS.show) {
      const stick = this.buildTuding().setPosition(0, 36);
      elbow.add(stick);
      this.tudings.push({ stick, shoulder, elbow });
    }

    elbow.add(fore);
    shoulder.add([upper, elbow]);
    return [shoulder, elbow];
  }
}
