import Phaser from 'phaser';
import gsap from 'gsap';
import { COLORS, EFFECTS, FIGHTER, GAME, KELIR, MATCH } from '../constants';
import { Fighter, type FireballEvent, type HitResult } from '../entities/Fighter';
import { Fireball } from '../entities/Fireball';
import { pieceKey } from '../entities/Puppet';
import { AIController } from '../systems/AIController';
import { Effects } from '../systems/Effects';
import { gununganTransition, preloadGunungan } from '../systems/Gunungan';
import { Hud } from '../systems/Hud';
import { KEYMAPS, KeyboardController, NO_INPUT, type Controller, type InputState } from '../systems/InputController';
import { Lighting } from '../systems/Lighting';
import type { Mode } from './TitleScene';

const hanomanPieces = import.meta.glob<string>('../assets/characters/hanoman/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});

const STEP_MS = 1000 / GAME.fps;

interface RoundData {
  mode: Mode;
  wins: [number, number];
  round: number;
}

type Phase = 'intro' | 'fight' | 'over';

// One round of a best-of-three. The scene restarts itself for each round,
// carrying the score in its data. Logic runs in fixed frames: fighters,
// fireballs, hits and hit-stop all advance together in step().
export class FightScene extends Phaser.Scene {
  private match!: RoundData;
  private fighters!: [Fighter, Fighter];
  private controllers!: [Controller, Controller];
  private fireballs: Fireball[] = [];
  private effects!: Effects;
  private hud!: Hud;
  private phase: Phase = 'intro';
  private framesLeft = 0;
  private hitStop = 0;
  private combo: [number, number] = [0, 0];
  private accumulator = 0;
  private pending: [InputState, InputState] = [NO_INPUT, NO_INPUT];

  constructor() {
    super('FightScene');
  }

  preload(): void {
    preloadGunungan(this);
    for (const [path, url] of Object.entries(hanomanPieces)) {
      const piece = path.split('/').pop()!.replace('.png', '');
      this.load.image(pieceKey('hanoman', piece), url);
    }
  }

  create(data: RoundData): void {
    this.match = data;
    this.phase = 'intro';
    this.fireballs = [];
    this.combo = [0, 0];
    this.hitStop = 0;
    this.accumulator = 0;
    this.pending = [NO_INPUT, NO_INPUT];
    this.framesLeft = MATCH.roundSeconds * GAME.fps;
    gsap.globalTimeline.resume();

    new Lighting(this);
    this.drawGedebog();
    this.effects = new Effects(this);

    const p1 = new Fighter(this, MATCH.startX[0], 1);
    const p2 = new Fighter(this, MATCH.startX[1], -1, FIGHTER.altTint);
    p1.opponent = p2;
    p2.opponent = p1;
    this.fighters = [p1, p2];
    this.fighters.forEach((f) => this.wireEvents(f));

    const cpu = data.mode !== 'versus';
    const fireballs = () => this.fireballs;
    this.controllers = [
      data.mode === 'demo' ? new AIController(p1, p2, fireballs) : new KeyboardController(this, KEYMAPS.p1),
      cpu ? new AIController(p2, p1, fireballs) : new KeyboardController(this, KEYMAPS.p2),
    ];
    this.hud = new Hud(this, ['Hanoman · P1', cpu ? 'Hanoman · Dalang' : 'Hanoman · P2'], data.wins);

    gununganTransition(this, () => {
      this.hud.announce(`Babak ${data.round}`, '', 0.6);
      this.time.delayedCall(800, () => {
        this.hud.announce('Perang!', '', 0.5);
        this.phase = 'fight';
      });
    });

    this.input.keyboard!.on('keydown-ESC', () => this.scene.start('TitleScene'));
  }

  update(_time: number, delta: number): void {
    this.accumulator = Math.min(this.accumulator + delta, STEP_MS * 4);
    this.collectInputs();
    while (this.accumulator >= STEP_MS) {
      this.accumulator -= STEP_MS;
      this.step(this.pending);
      // Presses count once, even if several logic frames run this render frame.
      this.pending = this.pending.map((i) => ({ ...NO_INPUT, left: i.left, right: i.right })) as [InputState, InputState];
    }
    this.hud.update(this.fighters, this.framesLeft / GAME.fps);
  }

  // Render frames can outnumber logic frames (120 Hz screens), and a key's
  // "just pressed" flag is only true for the render frame it was read in.
  // Presses are therefore held here until a logic frame consumes them.
  private collectInputs(): void {
    const live = this.controllers.map((c) => c.read()) as [InputState, InputState];
    this.pending = this.pending.map((held, i) => {
      if (this.phase !== 'fight') return NO_INPUT;
      const now = live[i];
      return {
        left: now.left,
        right: now.right,
        jumpPressed: held.jumpPressed || now.jumpPressed,
        handPressed: held.handPressed || now.handPressed,
        kickPressed: held.kickPressed || now.kickPressed,
        triwikramaPressed: held.triwikramaPressed || now.triwikramaPressed,
        ekorApiPressed: held.ekorApiPressed || now.ekorApiPressed,
        mengecilPressed: held.mengecilPressed || now.mengecilPressed,
      };
    }) as [InputState, InputState];
  }

  private step(inputs: [InputState, InputState]): void {
    if (this.hitStop > 0) {
      if (--this.hitStop === 0) gsap.globalTimeline.resume();
      return;
    }

    this.fighters.forEach((f, i) => f.tick(inputs[i]));
    this.fireballs.forEach((b) => b.tick());
    this.fireballs = this.fireballs.filter((b) => b.alive);
    this.separate();
    this.resolveHits();
    this.trackCombos();

    if (this.phase === 'fight' && --this.framesLeft <= 0) this.timeUp();
  }

  // Fighters cannot walk through each other; jumping over is allowed.
  private separate(): void {
    const [a, b] = this.fighters;
    const solid = (f: Fighter) => f.state !== 'ko' && f.state !== 'lying' && f.state !== 'knockdown';
    if (!solid(a) || !solid(b)) return;
    const ha = a.hurtbox();
    const hb = b.hurtbox();
    if (ha.bottom < hb.top + 30 || hb.bottom < ha.top + 30) return;
    const minDist = (ha.width + hb.width) / 2;
    const dx = b.x - a.x;
    const overlap = minDist - Math.abs(dx);
    if (overlap <= 0) return;
    const dir = Math.sign(dx) || 1;
    const clamp = (x: number) => Phaser.Math.Clamp(x, KELIR.wallMargin, GAME.width - KELIR.wallMargin);
    a.x = clamp(a.x - (dir * overlap) / 2);
    b.x = clamp(b.x + (dir * overlap) / 2);
    // Against a wall, the other fighter takes the rest of the push.
    const rest = minDist - Math.abs(b.x - a.x);
    if (rest > 0) {
      if (clamp(b.x + dir * rest) !== b.x + dir * rest) a.x = clamp(a.x - dir * rest);
      else b.x += dir * rest;
    }
  }

  private resolveHits(): void {
    // Both hitboxes are taken before either hit applies, so trades happen.
    const boxes = this.fighters.map((f) => f.hitbox());
    this.fighters.forEach((attacker, i) => {
      const box = boxes[i];
      const defender = attacker.opponent;
      if (!box || !attacker.move || defender.invulnerable) return;
      const hurt = defender.hurtbox();
      if (!Phaser.Geom.Intersects.RectangleToRectangle(box, hurt)) return;
      const contact = Phaser.Geom.Rectangle.Intersection(box, hurt);
      const move = attacker.move;
      const result = defender.receiveHit(move, attacker.x, attacker.power);
      attacker.onConnect(result);
      const heavy = !!move.launch || attacker.power > 1;
      this.onImpact(i, result, contact.centerX, contact.centerY, heavy, attacker.facing);
      if (result !== 'block') this.effects.label(move.label, attacker.x, attacker.y - 130 * attacker.sizeScale, heavy, `p${i}`);
    });

    for (const ball of this.fireballs) {
      if (!ball.alive) continue;
      const clash = this.fireballs.find(
        (o) => o !== ball && o.alive && o.owner !== ball.owner && Phaser.Geom.Intersects.RectangleToRectangle(o.area(), ball.area()),
      );
      if (clash) {
        this.effects.burst((ball.x + clash.x) / 2, (ball.y + clash.y) / 2, 1);
        ball.destroy();
        clash.destroy();
        continue;
      }
      const target = ball.owner.opponent;
      if (target.invulnerable || !Phaser.Geom.Intersects.RectangleToRectangle(ball.area(), target.hurtbox())) continue;
      const result = target.receiveHit(ball.move, ball.x - ball.direction * 40, ball.power);
      this.effects.burst(ball.x, ball.y, ball.power);
      this.onImpact(this.fighters.indexOf(ball.owner), result, ball.x, ball.y, true, ball.direction);
      ball.destroy();
    }
  }

  private onImpact(attacker: number, result: HitResult, x: number, y: number, heavy: boolean, direction: number): void {
    if (result === 'block') {
      this.effects.guard(x, y, direction);
      this.freeze(EFFECTS.blockStop);
      return;
    }
    this.effects.spark(x, y, heavy);
    this.combo[attacker]++;
    this.hud.combo(attacker, this.combo[attacker]);
    if (result === 'ko') return this.knockout(attacker);
    this.freeze(heavy ? EFFECTS.hitStopHeavy : EFFECTS.hitStop);
  }

  // Combo counters clear once the defender can act again.
  private trackCombos(): void {
    this.fighters.forEach((f, i) => {
      if (this.combo[i] && f.opponent.actionable) {
        this.combo[i] = 0;
        this.hud.combo(i, 0);
      }
    });
  }

  // Hit-stop: logic frames and every tween pause together.
  private freeze(frames: number): void {
    this.hitStop = Math.max(this.hitStop, frames);
    gsap.globalTimeline.pause();
  }

  private knockout(winner: number): void {
    this.freeze(MATCH.koFreeze);
    this.cameras.main.flash(300, 255, 236, 200);
    this.endRound(winner, 'Kalah!');
  }

  private timeUp(): void {
    const [a, b] = this.fighters;
    const winner = a.health === b.health ? -1 : a.health > b.health ? 0 : 1;
    this.endRound(winner, 'Waktu habis');
  }

  private endRound(winner: number, reason: string): void {
    if (this.phase === 'over') return;
    this.phase = 'over';
    const wins = [...this.match.wins] as [number, number];
    if (winner >= 0) {
      wins[winner]++;
      this.fighters[winner].celebrate();
    }
    this.hud.announce(reason, winner >= 0 ? `${this.sideName(winner)} unggul` : 'Seri');

    const champion = wins.findIndex((w) => w >= MATCH.roundsToWin);
    this.time.delayedCall(MATCH.roundEndDelayMs, () => {
      if (champion >= 0) return this.matchOver(champion);
      this.scene.restart({ ...this.match, wins, round: this.match.round + 1 });
    });
  }

  private matchOver(champion: number): void {
    this.hud.announce(`${this.sideName(champion)} menang!`, 'J  main lagi      Esc  menu');
    this.input.keyboard!.once('keydown-J', () =>
      this.scene.restart({ mode: this.match.mode, wins: [0, 0], round: 1 }),
    );
  }

  private sideName(i: number): string {
    if (i === 0) return 'Pemain 1';
    return this.match.mode === 'versus' ? 'Pemain 2' : 'Dalang';
  }

  private wireEvents(f: Fighter): void {
    f.on('fireball', (e: FireballEvent) => {
      this.effects.label(e.move.label, f.x, f.y - 130 * f.sizeScale, true, `p${this.fighters.indexOf(f)}`);
      this.fireballs.push(new Fireball(this, e, (x, y, size) => this.effects.ember(x, y, size)));
    });
    f.on('land', (x: number, y: number, impact?: boolean) => this.effects.dust(x, y, impact ? 2 : 1));
    f.on('jump', (x: number, y: number) => this.effects.dust(x, y, 0.6));
    f.on('aji', (name: string) => {
      if (name === 'triwikrama') {
        this.cameras.main.flash(250, 255, 224, 160);
        this.cameras.main.shake(300, 0.012);
        this.effects.label('Aji Triwikrama!', f.x, f.y - 230, true);
      }
      if (name === 'mengecil') this.effects.label('Mengecil', f.x, f.y - 60);
    });
  }

  // The gedebog (banana trunk) is where a dalang plants the puppets; here it is the floor.
  private drawGedebog(): void {
    const h = KELIR.floorHeight;
    const top = GAME.height - h;
    const g = this.add.graphics();
    g.fillStyle(COLORS.gedebog).fillRect(0, top, GAME.width, h);
    g.fillStyle(COLORS.gedebogTop).fillRect(0, top, GAME.width, 6);
    g.lineStyle(1, COLORS.gedebogTop, 0.5);
    for (let y = top + 18; y < GAME.height; y += 14) g.lineBetween(0, y, GAME.width, y);
  }
}
