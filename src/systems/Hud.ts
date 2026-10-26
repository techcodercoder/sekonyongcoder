import Phaser from 'phaser';
import gsap from 'gsap';
import { AJI, COLORS, FIGHTER, GAME, MATCH } from '../constants';
import type { Fighter } from '../entities/Fighter';
import { textStyle } from './Effects';

const DEPTH = 101; // above the vignette
const BAR_W = 480;
const BAR_H = 22;
const BAR_Y = 44;
const METER_W = 220;
const METER_Y = 104;
const EDGE = 40;

interface Side {
  health: Phaser.GameObjects.Rectangle;
  ghost: Phaser.GameObjects.Rectangle; // trails the health bar, showing the damage just taken
  meter: Phaser.GameObjects.Rectangle;
  combo: Phaser.GameObjects.Text;
  lastHealth: number;
}

// Fight HUD: health bars that drain toward the outer edges, the round
// timer, round pips, Aji meters and combo counters, plus a centre banner.
export class Hud {
  private sides: Side[];
  private timer: Phaser.GameObjects.Text;
  private banner: Phaser.GameObjects.Text;
  private sub: Phaser.GameObjects.Text;

  constructor(
    private scene: Phaser.Scene,
    names: [string, string],
    wins: [number, number],
  ) {
    this.sides = [0, 1].map((i) => this.buildSide(i, names[i], wins[i]));
    this.timer = scene.add.text(GAME.width / 2, BAR_Y + 4, '', textStyle(40)).setOrigin(0.5).setDepth(DEPTH);
    this.banner = scene.add.text(GAME.width / 2, 210, '', textStyle(64)).setOrigin(0.5).setDepth(DEPTH).setAlpha(0);
    this.sub = scene.add.text(GAME.width / 2, 268, '', textStyle(24)).setOrigin(0.5).setDepth(DEPTH).setAlpha(0);
  }

  private buildSide(i: number, name: string, wins: number): Side {
    const s = this.scene;
    const right = i === 1;
    const anchor = right ? 1 : 0;
    const x = right ? GAME.width - EDGE : EDGE;
    const frameX = right ? x - BAR_W : x;

    s.add.rectangle(frameX, BAR_Y, BAR_W, BAR_H, 0x2a170a, 0.85).setOrigin(0, 0.5).setDepth(DEPTH);
    // Bars keep full width and shrink with scaleX, which scales about the
    // origin; changing width would not move a right-hand origin.
    const barX = right ? x - 2 : x + 2;
    const ghost = s.add.rectangle(barX, BAR_Y, BAR_W - 4, BAR_H - 6, 0xfff1d0).setOrigin(anchor, 0.5).setDepth(DEPTH);
    const health = s.add.rectangle(barX, BAR_Y, BAR_W - 4, BAR_H - 6, 0xc23a1c).setOrigin(anchor, 0.5).setDepth(DEPTH);
    s.add.rectangle(frameX, BAR_Y, BAR_W, BAR_H).setOrigin(0, 0.5).setStrokeStyle(2, 0x3a1d08).setDepth(DEPTH);

    s.add.text(x, BAR_Y + 26, name, textStyle(20)).setOrigin(anchor, 0).setDepth(DEPTH);

    // Round pips sit at the inner end of the bar, one per round needed to win.
    for (let r = 0; r < MATCH.roundsToWin; r++) {
      const pipX = right ? frameX + 12 + r * 22 : frameX + BAR_W - 12 - r * 22;
      s.add
        .circle(pipX, BAR_Y + 36, 7, r < wins ? COLORS.gold : 0x2a170a, r < wins ? 1 : 0.5)
        .setStrokeStyle(2, 0x3a1d08)
        .setDepth(DEPTH);
    }

    const meterFrameX = right ? x - METER_W : x;
    s.add.rectangle(meterFrameX, METER_Y, METER_W, 12, 0x2a170a, 0.85).setOrigin(0, 0.5).setDepth(DEPTH);
    const meter = s.add
      .rectangle(right ? x - 2 : x + 2, METER_Y, METER_W - 4, 8, COLORS.gold)
      .setOrigin(anchor, 0.5)
      .setDepth(DEPTH)
      .setScale(0, 1);
    const notch = (AJI.ekorApi.cost / AJI.max) * METER_W;
    s.add.rectangle(right ? x - notch : x + notch, METER_Y, 2, 18, 0x3a1d08).setDepth(DEPTH);
    s.add
      .text(right ? x - METER_W - 8 : x + METER_W + 8, METER_Y, 'Aji', textStyle(16))
      .setOrigin(right ? 1 : 0, 0.5)
      .setDepth(DEPTH);

    const combo = s.add
      .text(x, METER_Y + 34, '', textStyle(28))
      .setOrigin(anchor, 0.5)
      .setDepth(DEPTH)
      .setAlpha(0);
    return { health, ghost, meter, combo, lastHealth: FIGHTER.maxHealth };
  }

  update(fighters: [Fighter, Fighter], secondsLeft: number): void {
    this.timer.setText(String(Math.max(0, Math.ceil(secondsLeft))));
    fighters.forEach((f, i) => {
      const side = this.sides[i];
      side.health.scaleX = f.health / FIGHTER.maxHealth;
      if (f.health !== side.lastHealth) {
        side.lastHealth = f.health;
        gsap.to(side.ghost, { scaleX: side.health.scaleX, duration: 0.5, delay: 0.35, ease: 'power2.in' });
      }
      side.meter.scaleX = f.meterShown / AJI.max;
      side.meter.fillColor = f.meterShown >= AJI.max ? 0xffe08a : COLORS.gold;
    });
  }

  combo(side: number, count: number): void {
    const t = this.sides[side].combo;
    if (count < 2) {
      if (t.alpha > 0) gsap.to(t, { alpha: 0, duration: 0.3 });
      return;
    }
    t.setText(`${count} Pukulan`).setAlpha(1);
    gsap.fromTo(t, { scale: 1.4 }, { scale: 1, duration: 0.2, ease: 'power2.out' });
  }

  // Big centre text; `sub` is a smaller line beneath. Stays until replaced
  // unless `seconds` is given.
  announce(text: string, sub = '', seconds?: number): void {
    gsap.killTweensOf([this.banner, this.sub]);
    this.banner.setText(text).setAlpha(1);
    this.sub.setText(sub).setAlpha(sub ? 1 : 0);
    gsap.fromTo(this.banner, { scale: 0.5 }, { scale: 1, duration: 0.25, ease: 'back.out(2.5)' });
    if (seconds) gsap.to([this.banner, this.sub], { alpha: 0, duration: 0.3, delay: seconds });
  }

  clearBanner(): void {
    gsap.to([this.banner, this.sub], { alpha: 0, duration: 0.2 });
  }
}
