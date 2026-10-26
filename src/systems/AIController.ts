import Phaser from 'phaser';
import { AI, AJI } from '../constants';
import type { Fighter } from '../entities/Fighter';
import type { Fireball } from '../entities/Fireball';
import { NO_INPUT, type Controller, type InputState } from './InputController';

type Intent = 'idle' | 'approach' | 'retreat' | 'block';

// The CPU opponent ("Lawan Dalang"). Re-decides every few frames, with a
// reaction delay, so it plays like a person rather than a frame-perfect bot.
export class AIController implements Controller {
  private wait = 0;
  private intent: Intent = 'idle';
  private press: Partial<InputState> = {};
  private chainsLeft = 0;
  private chainedMove?: object;
  private readFoeMove?: object;

  constructor(
    private me: Fighter,
    private foe: Fighter,
    private fireballs: () => Fireball[],
  ) {}

  read(): InputState {
    const toward = Math.sign(this.foe.x - this.me.x) || 1;
    const out: InputState = { ...NO_INPUT, ...this.press };
    this.press = {};

    this.reactToFoe(toward);
    this.continueCombo();

    const moveDir = this.intent === 'approach' ? toward : this.intent === 'retreat' || this.intent === 'block' ? -toward : 0;
    out.left = moveDir < 0;
    out.right = moveDir > 0;

    if (--this.wait <= 0 && this.me.actionable) {
      this.wait = Phaser.Math.Between(AI.decideEvery[0], AI.decideEvery[1]);
      this.decide(toward);
    }
    return out;
  }

  // Blocks or dodges once per enemy attack, a little after it starts.
  private reactToFoe(toward: number): void {
    const dist = Math.abs(this.foe.x - this.me.x);
    const incoming = this.fireballs().find(
      (f) => f.alive && f.owner === this.foe && Math.sign(this.me.x - f.x) === f.direction && Math.abs(this.me.x - f.x) < 260,
    );
    const foeMove = this.foe.state === 'attack' ? this.foe.move : incoming;
    if (!foeMove) {
      if (this.intent === 'block') this.intent = 'idle';
      return;
    }
    if (foeMove === this.readFoeMove) return;
    this.readFoeMove = foeMove;
    if (incoming && Math.random() < 0.4 && this.me.actionable) {
      this.press = { ...this.press, jumpPressed: true, right: toward > 0, left: toward < 0 };
      return;
    }
    if ((incoming || dist < AI.midRange) && Math.random() < AI.blockChance) this.intent = 'block';
  }

  // Presses again during its own move to chain into the next one.
  private continueCombo(): void {
    const move = this.me.move;
    if (this.me.state !== 'attack' || !move || move === this.chainedMove || this.chainsLeft <= 0) return;
    this.chainedMove = move;
    this.chainsLeft--;
    const kick = Math.random() < 0.5;
    if (kick && move.next.kick) this.press = { kickPressed: true };
    else if (move.next.hand) this.press = { handPressed: true };
    else if (move.next.kick) this.press = { kickPressed: true };
  }

  private decide(toward: number): void {
    if (this.intent === 'block' && this.foe.state === 'attack') return;
    const dist = Math.abs(this.foe.x - this.me.x);
    const roll = Math.random();
    this.chainsLeft = Math.random() < AI.chainChance ? Phaser.Math.Between(1, 2) : 0;

    if (this.me.meter >= AJI.max && roll < 0.3) {
      this.press = { triwikramaPressed: true };
      return;
    }

    if (dist > AI.midRange) {
      if (this.me.meter >= AJI.ekorApi.cost && roll < AI.fireballChance * 10) this.press = { ekorApiPressed: true };
      else if (roll < AI.jumpChance) this.press = { jumpPressed: true, right: toward > 0, left: toward < 0 };
      this.intent = 'approach';
    } else if (dist > AI.closeRange) {
      if (roll < 0.35) this.press = { kickPressed: true };
      else if (roll < 0.45 && this.foe.state === 'idle') this.intent = 'retreat';
      else this.intent = 'approach';
    } else {
      this.intent = 'idle';
      if (roll < 0.45) this.press = { handPressed: true };
      else if (roll < 0.85) this.press = { kickPressed: true };
      else this.intent = 'retreat';
    }
  }
}
